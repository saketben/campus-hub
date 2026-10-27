"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function ago(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

type Source = "classroom" | "gmail";
const NAMES: Record<Source, string> = { classroom: "Classroom", gmail: "Gmail" };

// "Last updated …" line. When the page opens, and whenever the student comes back to
// the tab or app, it asks the server to check each connected source (D1); if
// anything was fetched, it reloads the page. The server limits this to once a
// minute per student per source.
export function SyncStatus({ lastSyncedAt, sources }: { lastSyncedAt: string | null; sources: Source[] }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(true);
  const [failed, setFailed] = useState<Source[]>([]);
  const [reading, setReading] = useState(false);
  const key = sources.join(",");

  useEffect(() => {
    let cancelled = false;
    const list = key.split(",").filter(Boolean) as Source[];
    const check = () => {
      setUpdating(true);
      Promise.all(
        list.map((source) =>
          fetch(`/api/${source}/sync`, { method: "POST" })
            .then((res) => res.json())
            .then(({ result }) => result as string)
            .catch(() => "failed"),
        ),
      )
        .then(async (results) => {
          if (cancelled) return;
          if (results.some((r) => r === "synced" || r === "needs_reconnect")) router.refresh();
          setFailed(list.filter((_, i) => results[i] === "failed"));
          // Then the AI reads a few of the newest waiting messages (step 7).
          setReading(true);
          const { read } = await fetch("/api/read", { method: "POST" })
            .then((res) => res.json())
            .catch(() => ({ read: 0 }));
          if (!cancelled && read > 0) router.refresh();
        })
        .finally(() => {
          if (cancelled) return;
          setUpdating(false);
          setReading(false);
        });
    };
    const onReturn = () => document.visibilityState === "visible" && check();

    check();
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [router, key]);

  return (
    <p className="text-xs text-zinc-500" aria-live="polite">
      {reading
        ? "Reading new messages…"
        : updating
        ? `Updating from ${sources.map((s) => NAMES[s]).join(" and ")}…`
        : failed.length
          ? `Couldn't reach ${failed.map((s) => NAMES[s]).join(" or ")} just now. ${lastSyncedAt ? `Showing what we had ${ago(lastSyncedAt)}.` : ""}`
          : lastSyncedAt
            ? `Last updated ${ago(lastSyncedAt)}`
            : ""}
    </p>
  );
}
