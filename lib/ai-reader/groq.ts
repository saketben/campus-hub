import { SYSTEM_PROMPT, userMessage, type MessageToRead } from "./prompt";
import { LenientExtractedItems } from "./schema";
import { BadAnswerError, QuotaExhaustedError, RateLimitedError, TooLargeError } from "./errors";
import type { ReadResult } from "./index";

// Groq (chosen 2026-10-16: openai/gpt-oss-120b). OpenAI-style chat API.
export async function readWithGroq(message: MessageToRead, model: string): Promise<ReadResult> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage(message) },
      ],
      response_format: { type: "json_object" },
      reasoning_effort: "medium",
      temperature: 0,
    }),
  });
  const body = await res.json();

  if (!res.ok) {
    const text: string = body.error?.message ?? JSON.stringify(body);
    if (res.status === 413) throw new TooLargeError(text);
    if (res.status === 429 && /per day|TPD|RPD/i.test(text)) throw new QuotaExhaustedError(text);
    if (res.status === 429) throw new RateLimitedError(text, Number(res.headers.get("retry-after")) || 10);
    if (res.status === 400 && /validate JSON/i.test(text)) throw new BadAnswerError(text);
    throw new Error(`Groq HTTP ${res.status}: ${text}`);
  }

  let parsed;
  try {
    parsed = LenientExtractedItems.parse(JSON.parse(body.choices[0].message.content));
  } catch (e) {
    throw new BadAnswerError(`Groq answer didn't match the expected shape: ${e}`);
  }
  return {
    items: parsed.items,
    provider: "groq",
    model,
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
  };
}
