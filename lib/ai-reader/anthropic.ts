import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SYSTEM_PROMPT, userMessage, type MessageToRead } from "./prompt";
import { ExtractedItems } from "./schema";
import { BadAnswerError, QuotaExhaustedError, RateLimitedError } from "./errors";
import type { ReadResult } from "./index";

// Anthropic (Claude Haiku 5.5): ready for when the pilot scales (Saket, 2026-10-16).
// Not used until AI_PROVIDER=anthropic and ANTHROPIC_API_KEY are set.
// Structured outputs make the API itself guarantee the answer's shape.
let client: Anthropic | undefined; // created on first use; reads ANTHROPIC_API_KEY

export async function readWithAnthropic(message: MessageToRead, model: string): Promise<ReadResult> {
  client ??= new Anthropic({ maxRetries: 0 }); // callers handle retries
  let response;
  try {
    response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage(message) }],
      output_config: { effort: "medium", format: zodOutputFormat(ExtractedItems) },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new RateLimitedError(e.message, 30);
    if (e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.AuthenticationError) throw new QuotaExhaustedError(e.message);
    throw e;
  }

  if (response.stop_reason === "refusal") throw new BadAnswerError(`Declined: ${response.stop_details?.explanation ?? "no reason given"}`);
  if (!response.parsed_output) throw new BadAnswerError(`No usable answer (stop_reason: ${response.stop_reason})`);

  return {
    items: response.parsed_output.items,
    provider: "anthropic",
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
