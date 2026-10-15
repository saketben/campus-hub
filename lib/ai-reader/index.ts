import "server-only";
import type { MessageToRead } from "./prompt";
import type { ExtractedItem } from "./schema";

// The "AI reader": turns one email or Classroom announcement into items.
// Which AI does the reading is a setting, not code:
//   AI_PROVIDER=groq      (default; pilot)  AI_MODEL defaults to openai/gpt-oss-120b
//   AI_PROVIDER=anthropic (later, at scale) AI_MODEL defaults to claude-haiku-5-5
// Switching = change these two settings (+ add that provider's key). Before
// switching, run the accuracy test on the new provider:
//   npx tsx --env-file=.env.local --conditions=react-server feasibility/6-run-test.mts anthropic

export type ReadResult = {
  items: ExtractedItem[];
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

const DEFAULT_MODELS: Record<string, string> = {
  groq: "openai/gpt-oss-120b",
  anthropic: "claude-haiku-5-5",
};

export async function readMessage(message: MessageToRead, opts: { provider?: string; model?: string } = {}): Promise<ReadResult> {
  const provider = opts.provider ?? process.env.AI_PROVIDER ?? "groq";
  const model = opts.model ?? process.env.AI_MODEL ?? DEFAULT_MODELS[provider];
  if (provider === "groq") return (await import("./groq")).readWithGroq(message, model);
  if (provider === "anthropic") return (await import("./anthropic")).readWithAnthropic(message, model);
  throw new Error(`Unknown AI_PROVIDER "${provider}" (use "groq" or "anthropic")`);
}

export type { MessageToRead } from "./prompt";
export type { ExtractedItem } from "./schema";
export { RateLimitedError, QuotaExhaustedError, TooLargeError, BadAnswerError } from "./errors";
