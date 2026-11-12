"use client";

import { useState, type ReactNode } from "react";

export type CalendarDay = { key: string; count: number; important: boolean; cards: ReactNode };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const monthName = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const dayKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Month grid (Stage 6): a dot per item on each day (amber for placements), tap a
// day to see its items below. The cards are drawn on the server, the same as in
// the list, so Dismiss and links work here too.
export function Calendar({ days, today }: { days: CalendarDay[]; today: string }) {
  const byKey = new Map(days.map((d) => [d.key, d]));
  const [y0, m0] = today.split("-").map(Number);
  const [month, setMonth] = useState({ y: y0, m: m0 - 1 });
  const [selected, setSelected] = useState(today);

  const first = new Date(Date.UTC(month.y, month.m, 1)).getUTCDay(); // 0 = Sunday
  const blanks = (first + 6) % 7; // weeks start on Monday
  const length = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const move = (step: number) => {
    const d = new Date(Date.UTC(month.y, month.m + step, 1));
    setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const chosen = byKey.get(selected);
  const chosenLabel = new Date(`${selected}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => move(-1)} className="rounded-lg px-3 py-1 text-lg" aria-label="Previous month">
            ‹
          </button>
          <p className="font-medium">{monthName(month.y, month.m)}</p>
          <button type="button" onClick={() => move(1)} className="rounded-lg px-3 py-1 text-lg" aria-label="Next month">
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1 text-center text-sm">
          {Array.from({ length: blanks }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length }, (_, i) => {
            const key = dayKey(month.y, month.m, i + 1);
            const day = byKey.get(key);
            const isSelected = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={`${i + 1}${day ? `, ${day.count} item${day.count === 1 ? "" : "s"}` : ""}`}
                className={`flex h-11 flex-col items-center justify-center rounded-lg ${
                  isSelected ? "bg-blue-100 font-medium text-blue-900 dark:bg-blue-950 dark:text-blue-100" : ""
                } ${key === today && !isSelected ? "ring-1 ring-zinc-400" : ""}`}
              >
                {i + 1}
                <span className="flex h-1.5 gap-0.5">
                  {day &&
                    Array.from({ length: Math.min(day.count, 3) }, (_, j) => (
                      <span
                        key={j}
                        className={`h-1.5 w-1.5 rounded-full ${day.important && j === 0 ? "bg-amber-500" : "bg-blue-500"}`}
                      />
                    ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{chosenLabel}</h2>
        {chosen ? (
          <ul className="flex flex-col gap-3">{chosen.cards}</ul>
        ) : (
          <p className="text-sm text-zinc-500">Nothing found for this day.</p>
        )}
      </section>
    </div>
  );
}
