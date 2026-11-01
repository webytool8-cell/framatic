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
