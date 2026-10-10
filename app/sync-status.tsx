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

// "Last updated …" line. When the page opens it asks the server to check Classroom
// (D1); if anything was fetched, it reloads the list.
export function SyncStatus({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/classroom/sync", { method: "POST" })
      .then((res) => res.json())
      .then(({ result }) => {
        if (cancelled) return;
        if (result === "synced" || result === "needs_reconnect") router.refresh();
        setFailed(result === "failed");
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setUpdating(false));
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <p className="text-xs text-zinc-500" aria-live="polite">
      {updating
        ? "Updating from Classroom…"
        : failed
          ? `Couldn't reach Classroom just now. ${lastSyncedAt ? `Showing what we had ${ago(lastSyncedAt)}.` : ""}`
          : lastSyncedAt
            ? `Last updated ${ago(lastSyncedAt)}`
            : ""}
    </p>
  );
}
