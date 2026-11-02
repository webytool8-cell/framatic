import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { log } from "@/lib/log";
import { costForUsage, type UsageMeter } from "./usage";

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
    private meter?: UsageMeter,
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
      const t0 = Date.now();
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 8000,
        system: req.system,
        tools: [tool],
        tool_choice: { type: "tool", name: req.toolName },
        messages,
      });
      const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const parsed = block ? req.schema.safeParse(block.input) : null;
      await this.meter?.({
        model: res.model || this.model,
        tool: req.toolName,
        attempt,
        inputTokens: res.usage?.input_tokens ?? 0,
        outputTokens: res.usage?.output_tokens ?? 0,
        cacheReadTokens: res.usage?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: res.usage?.cache_creation_input_tokens ?? 0,
        costUsd: costForUsage(res.model || this.model, res.usage),
        durationMs: Date.now() - t0,
        ok: !!parsed?.success,
      });
      if (!block || !parsed) throw new LLMOutputError("The AI did not return structured output.");
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

/**
 * "creative" writes the ad concepts (quality matters most). "analysis" reads
 * the product pages into a brand profile: a smaller, faster model does this
 * well, with the creative model as a fallback if its answer doesn't validate.
 */
export type LLMRole = "analysis" | "creative";

export function creativeModel(): string {
  return process.env.FRAMATIC_LLM_MODEL || "claude-sonnet-5-5";
}
export function analysisModel(): string {
  return process.env.FRAMATIC_ANALYSIS_MODEL || "claude-haiku-5-5";
}

export function getLLM(role: LLMRole = "creative", meter?: UsageMeter): StructuredLLM {
  if (override) return override;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new LLMNotConfiguredError();
  const creative = new AnthropicLLM(key, creativeModel(), 2, meter);
  if (role === "creative" || analysisModel() === creativeModel()) return creative;
  return new FallbackLLM(new AnthropicLLM(key, analysisModel(), 1, meter), creative);
}

/** Should a failure of the fast model be retried on the main model? */
export function shouldFallBack(e: unknown): boolean {
  const err = e as { name?: string; status?: number; message?: string };
  if (err?.name === "LLMOutputError") return true; // invalid or cut-off structured output
  if (err?.status === 404) return true; // model not available to this account
  return err?.status === 400 && /model/i.test(err.message ?? "");
}

/** Try a primary model; on bad output or an unavailable model, use the secondary. */
export class FallbackLLM implements StructuredLLM {
  readonly name: string;
  constructor(
    private primary: StructuredLLM,
    private secondary: StructuredLLM,
  ) {
    this.name = `${primary.name}→${secondary.name}`;
  }
  async generate<T>(req: StructuredRequest<T>): Promise<T> {
    try {
      return await this.primary.generate(req);
    } catch (e) {
      if (!shouldFallBack(e)) throw e;
      log.warn("fast model failed, falling back", { tool: req.toolName, error: (e as Error).message });
      return this.secondary.generate(req);
    }
  }
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
    return `The AI model "${creativeModel()}" isn't available to your Anthropic account. Remove FRAMATIC_LLM_MODEL in Vercel or set it to a model your account can use.`;
  }
  if (status === 429) return "The AI service is rate-limiting this account right now. Wait a minute and try again.";
  if (status === 529 || (status && status >= 500)) return "The AI service is temporarily unavailable. Please try again in a minute.";
  if (status === 400 && detail) return `The AI service rejected the request: ${detail.replace(/^\d{3}\s*/, "").slice(0, 200)}`;
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|timed? ?out/i.test(detail)) return "Couldn't reach the AI service. Please try again.";
  return "Concept generation failed. Please try again.";
}
