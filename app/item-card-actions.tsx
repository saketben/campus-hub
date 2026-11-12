"use client";

import { useState, useTransition, type ReactNode } from "react";
import { setItemStatus } from "./actions";

type Mode = "active" | "possible" | "unreadable" | "dismissed";

const button =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

// One card on the home list with its confirm / dismiss buttons (step 8).
// Taps save straight away; a dismissed card shrinks to one line with "Undo",
// so a slip costs one more tap. Dismissed items are hidden, never deleted.
export function ItemCardShell({
  id,
  title,
  mode,
  header,
  children,
}: {
  id: string;
  title: string;
  mode: Mode;
  header: ReactNode;
  children: ReactNode;
}) {
  const [state, setState] = useState<Mode>(mode);
  const [pending, startTransition] = useTransition();

  const choose = (choice: "confirm" | "dismiss" | "restore", next: Mode, refreshPage = false) => {
    const before = state;
    setState(next);
    startTransition(async () => {
      try {
        await setItemStatus(id, choice, refreshPage);
      } catch {
        setState(before);
      }
    });
  };

  const card = "flex flex-col gap-1 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800";

  // Just dismissed on this visit: one line, with a way back.
  if (state === "dismissed" && mode !== "dismissed") {
    return (
      <li className={`${card} flex-row items-center justify-between gap-3 text-sm text-zinc-500`}>
        <span className="min-w-0 truncate">Dismissed: {title}</span>
        <button type="button" disabled={pending} onClick={() => choose("restore", mode)} className={button}>
          Undo
        </button>
      </li>
    );
  }

  return (
    <li className={card}>
      {header}
      {state === "possible" && (
        <p className="self-start rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Possible deadline: confirm?
        </p>
      )}
      {children}
      <div className="mt-2 flex flex-wrap gap-2">
        {state === "possible" && (
          <button type="button" disabled={pending} onClick={() => choose("confirm", "active")} className={button}>
            Yes, it&apos;s real
          </button>
        )}
        {state === "dismissed" ? (
          <button type="button" disabled={pending} onClick={() => choose("restore", "active", true)} className={button}>
            {pending ? "Putting back…" : "Put back on my list"}
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => choose("dismiss", "dismissed")} className={button}>
            {state === "possible" ? "Not relevant" : state === "unreadable" ? "I've checked it" : "Dismiss"}
          </button>
        )}
      </div>
    </li>
  );
}
