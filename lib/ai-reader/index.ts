import "server-only";
import type { MessageToRead } from "./prompt";
import type { ExtractedItem } from "./schema";
import { BadAnswerError, QuotaExhaustedError } from "./errors";

// The "AI reader": turns one email or Classroom announcement into items.
// Which AI does the reading is a setting, not code:
//   AI_PROVIDER=groq      (default; pilot)  AI_MODEL defaults to openai/gpt-oss-120b
//   AI_PROVIDER=anthropic (later, at scale) AI_MODEL defaults to claude-haiku-5-5
// Switching = change these two settings (+ add that provider's key). Before
// switching, run the accuracy test on the new provider:
//   npx tsx --env-file=.env.local --conditions=react-server feasibility/6-run-test.mts anthropic
// On Groq, Classroom announcements go to the smaller openai/gpt-oss-20b (its own
// free daily allowance; as accurate as 120b on announcements, but it breaks on
// multi-deadline emails, so emails never go to it). If 20b's answer is broken or
// its allowance is used up, the announcement is read again by the main model.
// AI_ANNOUNCEMENT_MODEL changes it; set it to the main model to turn this off.

export type ReadResult = {
  items: ExtractedItem[];
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

const GROQ_ANNOUNCEMENT_MODEL = "openai/gpt-oss-20b";

const DEFAULT_MODELS: Record<string, string> = {
  groq: "openai/gpt-oss-120b",
  anthropic: "claude-haiku-5-5",
};

export async function readMessage(message: MessageToRead, opts: { provider?: string; model?: string } = {}): Promise<ReadResult> {
  const provider = opts.provider ?? process.env.AI_PROVIDER ?? "groq";
  const model = opts.model ?? process.env.AI_MODEL ?? DEFAULT_MODELS[provider];
  if (provider === "groq") {
    const { readWithGroq } = await import("./groq");
    const announcementModel = process.env.AI_ANNOUNCEMENT_MODEL ?? GROQ_ANNOUNCEMENT_MODEL;
    if (message.kind === "announcement" && !opts.model && announcementModel !== model) {
      try {
        return await readWithGroq(message, announcementModel);
      } catch (e) {
        if (!(e instanceof BadAnswerError || e instanceof QuotaExhaustedError)) throw e;
      }
    }
    return readWithGroq(message, model);
  }
  if (provider === "anthropic") return (await import("./anthropic")).readWithAnthropic(message, model);
  throw new Error(`Unknown AI_PROVIDER "${provider}" (use "groq" or "anthropic")`);
}

export type { MessageToRead } from "./prompt";
export type { ExtractedItem } from "./schema";
export { RateLimitedError, QuotaExhaustedError, TooLargeError, BadAnswerError } from "./errors";
