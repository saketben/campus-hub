"use client";

import { useState, useTransition } from "react";
import { saveSettings } from "./actions";
import { CATEGORY_NAMES, type Category } from "@/lib/categories";

const ORDER: Category[] = ["placements", "courses", "competitions", "clubs", "other"];

// Filter chips + List/Calendar switch (Stage 6). Saved to the student's account,
// so the choice follows them between phone and laptop. Filters only hide, and the
// line under the chips says what's hidden (trust rule).
export function ViewControls({
  hidden,
  view,
  hiddenCounts,
}: {
  hidden: Category[];
  view: "list" | "calendar";
  hiddenCounts: Partial<Record<Category, number>>;
}) {
  const [chips, setChips] = useState(hidden);
  const [mode, setMode] = useState(view);
  const [pending, startTransition] = useTransition();

  const save = (change: { hidden?: Category[]; view?: "list" | "calendar" }) =>
    startTransition(async () => {
      try {
        await saveSettings(change);
      } catch {
        setChips(hidden);
        setMode(view);
      }
    });

  const toggle = (c: Category) => {
    const next = chips.includes(c) ? chips.filter((x) => x !== c) : [...chips, c];
    setChips(next);
    save({ hidden: next });
  };

  const hiddenText = ORDER.filter((c) => chips.includes(c) && hiddenCounts[c])
    .map((c) => `${hiddenCounts[c]} ${CATEGORY_NAMES[c].toLowerCase()}`)
    .join(", ");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show these categories">
          {ORDER.map((c) => {
            const on = !chips.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  on
                    ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
                    : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
                }`}
              >
                {on ? "✓ " : ""}
                {CATEGORY_NAMES[c]}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 rounded-lg border border-zinc-300 p-0.5 text-sm dark:border-zinc-700" role="group" aria-label="View">
          {(["list", "calendar"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={mode === v}
              onClick={() => {
                setMode(v);
                save({ view: v });
              }}
              className={`rounded-md px-2.5 py-1 ${mode === v ? "bg-zinc-100 font-medium dark:bg-zinc-800" : "text-zinc-500"}`}
            >
              {v === "list" ? "List" : "Calendar"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-zinc-500" aria-live="polite">
        {pending ? "Saving…" : hiddenText ? `Hidden by your filters: ${hiddenText}. Tap a category to show it.` : ""}
      </p>
    </div>
  );
}
