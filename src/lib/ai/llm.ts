import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { log } from "@/lib/log";

/**
 * Provider-agnostic structured generation. Every response is validated with
 * Zod; invalid output is sent back to the model with the validation errors
 * (bounded retries). Nothing the model returns is ever executed.
 */
export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  toolName: string;
  toolDescription: string;
  maxTokens?: number;
}

export interface StructuredLLM {
  readonly name: string;
  generate<T>(req: StructuredRequest<T>): Promise<T>;
}

export class LLMNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Set ANTHROPIC_API_KEY on the server.");
    this.name = "LLMNotConfiguredError";
  }
}

export class LLMOutputError extends Error {
  constructor(
    message: string,
    public readonly issues?: string[],
  ) {
    super(message);
    this.name = "LLMOutputError";
  }
}

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 25).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export class AnthropicLLM implements StructuredLLM {
  readonly name = "anthropic";
  private client: Anthropic;
  constructor(
    apiKey: string,
    private model: string,
    private maxValidationRetries = 2,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 3, timeout: 120_000 });
  }

  async generate<T>(req: StructuredRequest<T>): Promise<T> {
    const tool = {
      name: req.toolName,
      description: req.toolDescription,
      input_schema: toJsonSchema(req.schema) as Anthropic.Tool["input_schema"],
    };
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: req.prompt }];
    let lastIssues: string[] = [];

    for (let attempt = 0; attempt <= this.maxValidationRetries; attempt++) {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 8000,
        system: req.system,
        tools: [tool],
        tool_choice: { type: "tool", name: req.toolName },
        messages,
      });
      const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!block) throw new LLMOutputError("The AI did not return structured output.");
      const parsed = req.schema.safeParse(block.input);
      if (parsed.success) return parsed.data;

      lastIssues = formatIssues(parsed.error);
      log.warn("llm output failed validation", { tool: req.toolName, attempt, issues: lastIssues.slice(0, 8) });
      if (res.stop_reason === "max_tokens") {
        throw new LLMOutputError("The AI response was cut off before it finished.", lastIssues);
      }
      messages.push({ role: "assistant", content: res.content });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: `Your output did not match the schema. Fix these problems and call ${req.toolName} again with the complete corrected object:\n${lastIssues.join("\n")}`,
          },
        ],
      });
    }
    throw new LLMOutputError("The AI returned output that failed validation.", lastIssues);
  }
}

let override: StructuredLLM | null = null;

/** Test hook: inject a fake model. */
export function setLLMForTesting(llm: StructuredLLM | null) {
  override = llm;
}

export function isLLMConfigured(): boolean {
  return !!override || !!process.env.ANTHROPIC_API_KEY;
}

export function getLLM(): StructuredLLM {
  if (override) return override;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new LLMNotConfiguredError();
  return new AnthropicLLM(key, process.env.FRAMATIC_LLM_MODEL || "claude-sonnet-5-5");
}

/**
 * Turn an AI-provider failure into a message that says what to fix.
 * Covers billing, bad keys, unknown models, rate limits and outages.
 */
export function describeLLMError(e: unknown): string {
  const err = e as { name?: string; status?: number; message?: string; error?: { error?: { message?: string; type?: string } } };
  if (err?.name === "LLMNotConfiguredError") return "AI isn't switched on for this server yet: ANTHROPIC_API_KEY is missing in your environment variables.";
  if (err?.name === "LLMOutputError") return "The AI returned an incomplete answer. Please try again.";
  const detail = err?.error?.error?.message ?? err?.message ?? "";
  const status = err?.status;
  if (/credit balance|billing|purchase credits|plans? & billing/i.test(detail)) {
    return "Your Anthropic account is out of credit. Add credit at console.anthropic.com → Billing, then try again.";
  }
  if (status === 401) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel (no spaces or quotes), then redeploy.";
  if (status === 403) return "The Anthropic API key doesn't have permission for this request. Check the key's workspace in console.anthropic.com.";
  if (status === 404 || /model/i.test(detail) && /not.?found|does not exist|invalid/i.test(detail)) {
    return `The AI model "${process.env.FRAMATIC_LLM_MODEL || "claude-sonnet-5-5"}" isn't available to your Anthropic account. Remove FRAMATIC_LLM_MODEL in Vercel or set it to a model your account can use.`;
  }
  if (status === 429) return "The AI service is rate-limiting this account right now. Wait a minute and try again.";
  if (status === 529 || (status && status >= 500)) return "The AI service is temporarily unavailable. Please try again in a minute.";
  if (status === 400 && detail) return `The AI service rejected the request: ${detail.replace(/^\d{3}\s*/, "").slice(0, 200)}`;
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|timed? ?out/i.test(detail)) return "Couldn't reach the AI service. Please try again.";
  return "Concept generation failed. Please try again.";
}
