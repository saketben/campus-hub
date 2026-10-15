import { z } from "zod";

// The shape every provider must return. Anthropic is held to it by the API itself
// (structured outputs); Groq's JSON is checked against it after the fact.
export const ITEM_TYPES = [
  "assignment",
  "pre_read",
  "class",
  "guest_lecture",
  "placement_activity",
  "placement_deadline",
  "other",
] as const;

export const ExtractedItem = z.object({
  title: z.string(),
  type: z.enum(ITEM_TYPES),
  date: z.string(), // YYYY-MM-DD or ""
  time: z.string(), // HH:MM or ""
  end_time: z.string(), // HH:MM or ""
  confidence: z.number(),
});

export const ExtractedItems = z.object({ items: z.array(ExtractedItem) });

export type ExtractedItem = z.infer<typeof ExtractedItem>;

// A forgiving version for providers without schema enforcement (Groq): an unknown
// type becomes "other" and a missing field becomes "" rather than losing the answer.
export const LenientExtractedItems = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      type: z.enum(ITEM_TYPES).catch("other"),
      date: z.string().catch(""),
      time: z.string().catch(""),
      end_time: z.string().catch(""),
      confidence: z.number().catch(0.5),
    }),
  ),
});
