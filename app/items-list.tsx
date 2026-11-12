import type { Category } from "@/lib/categories";
import type { Item, Settings } from "@/lib/views";
import { ItemCardShell } from "./item-card-actions";
import { Calendar, type CalendarDay } from "./calendar";
import { ViewControls } from "./view-controls";

export type ReadingProgress = { done: number; total: number };

const IST = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const RECENT_UNDATED_DAYS = 14;
// Things with a "by" date; the rest (classes, talks, events) just happen at a time.
const DEADLINE_TYPES = ["assignment", "placement_deadline"];
const TYPE_NAMES: Record<string, string> = {
  assignment: "Assignment",
  pre_read: "Pre-read",
  class: "Class",
  guest_lecture: "Guest lecture",
  placement_activity: "Placement",
  placement_deadline: "Placement deadline",
  other: "Other",
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });

function whenLabel(item: Item, now: number) {
  if (!item.due_at) return null;
  const due = new Date(item.due_at);
  const date = due.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
  const at = item.all_day ? date : `${date}, ${time(item.due_at)}${item.ends_at ? ` – ${time(item.ends_at)}` : ""}`;
  const days = Math.floor((due.getTime() - now) / DAY);
  const soon = days < 1 ? "within a day" : days < 7 ? `in ${days} day${days === 1 ? "" : "s"}` : null;
  return { text: DEADLINE_TYPES.includes(item.type) ? `Due ${at}` : at, soon };
}

function postedLabel(item: Item) {
  if (!item.posted_at) return null;
  return `Posted ${new Date(item.posted_at).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" })}`;
}

// Where it came from: the course, or who sent the email.
function fromLabel(item: Item) {
  if (item.course_name) return item.course_name;
  if (item.sender) return `Email from ${item.sender}`;
  return item.source === "gmail" ? "Email" : null;
}

const isUnreadable = (item: Item) => item.source_id?.endsWith("/unreadable") ?? false;

function ItemCard({ item, now }: { item: Item; now: number }) {
  const highlight = item.category === "placements" && item.status !== "dismissed";
  const when = whenLabel(item, now);
  const mode =
    item.status === "dismissed"
      ? "dismissed"
      : isUnreadable(item)
        ? "unreadable"
        : item.status === "needs_review"
          ? "possible"
          : "active";
  return (
    <ItemCardShell
      id={item.id}
      title={item.title}
      mode={mode}
      highlight={highlight}
      header={
        <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <span className="break-all">{fromLabel(item)}</span>
          <span className="font-normal normal-case tracking-normal">· {TYPE_NAMES[item.type] ?? item.type}</span>
        </p>
      }
    >
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {when ? (
          <>
            {when.text}
            {when.soon && <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">{when.soon}</span>}
          </>
        ) : (
          postedLabel(item)
        )}
      </p>
      {item.details && (
        <p className="line-clamp-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{item.details}</p>
      )}
      {item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 self-start text-sm font-medium text-blue-700 underline dark:text-blue-400"
        >
          {item.source === "gmail" ? "Open in Gmail ↗" : "Open in Classroom ↗"}
        </a>
      )}
    </ItemCardShell>
  );
}

function Group({
  title,
  items,
  now,
  note,
}: {
  title: string;
  items: Item[];
  now: number;
  note?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {title} <span className="font-normal text-zinc-500">({items.length})</span>
      </h2>
      {note && <p className="-mt-2 text-xs text-zinc-500">{note}</p>}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} now={now} />
        ))}
      </ul>
    </section>
  );
}

// A group that starts folded ("Later this term", dismissed items).
function Folded({ title, items, now }: { title: string; items: Item[]; now: number }) {
  if (items.length === 0) return null;
  return (
    <details className="flex flex-col gap-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {title} <span className="font-normal text-zinc-500">({items.length})</span>
      </summary>
      <ul className="mt-3 flex flex-col gap-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} now={now} />
        ))}
      </ul>
    </details>
  );
}

const istDay = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: IST }); // 2026-11-12

// Everything found so far, as a list or a calendar, with the student's filters.
// Every section uses this; Home also pins the next week's placements on top.
// Never claims to be complete (trust rule).
export function ItemsView({
  items,
  settings,
  now,
  pinPlacements = false,
  header,
  empty,
}: {
  items: Item[];
  settings: Settings;
  now: number;
  pinPlacements?: boolean;
  header?: React.ReactNode;
  empty: string;
}) {
  const byPosted = (a: Item, b: Item) => Date.parse(b.posted_at ?? "") - Date.parse(a.posted_at ?? "");
  const byDue = (a: Item, b: Item) => Date.parse(a.due_at!) - Date.parse(b.due_at!);
  // Classroom materials: no date, shown as "recent pre-reads".
  const isMaterial = (i: Item) => i.source_id?.startsWith("material:") ?? false;
  // Still on: not yet due, or (for a session with an end time) not yet over.
  const isUpcoming = (i: Item) => Boolean(i.due_at) && Date.parse(i.ends_at ?? i.due_at!) >= now;
  // Undated: Classroom assignments always; found items only if recent (old ones are noise).
  const isUndated = (i: Item) =>
    !i.due_at &&
    !isMaterial(i) &&
    !isUnreadable(i) &&
    (Boolean(i.source_id?.startsWith("coursework:")) || now - Date.parse(i.posted_at ?? "") <= RECENT_UNDATED_DAYS * DAY);
  const relevant = (i: Item) => isUpcoming(i) || isUndated(i) || isMaterial(i) || isUnreadable(i);

  // Filters only hide, and say how many (trust rule). "Couldn't read" emails are
  // never hidden: we don't know what's in them.
  const hidden = (i: Item) => settings.hidden.includes(i.category) && !isUnreadable(i);
  const active = items.filter((i) => i.status !== "dismissed" && relevant(i));
  const hiddenCounts: Partial<Record<Category, number>> = {};
  for (const i of active.filter(hidden)) hiddenCounts[i.category] = (hiddenCounts[i.category] ?? 0) + 1;
  const shown = active.filter((i) => !hidden(i));
  // Dismissed items are hidden from the groups, never deleted, and can be put back.
  const dismissed = items.filter((i) => i.status === "dismissed" && relevant(i)).sort(byPosted);

  const upcoming = shown.filter(isUpcoming).sort(byDue);
  const today = istDay(now);
  const weekEnd = now + 7 * DAY;
  const pinned = pinPlacements
    ? upcoming.filter((i) => i.category === "placements" && Date.parse(i.due_at!) <= weekEnd)
    : [];
  const rest = upcoming.filter((i) => !pinned.includes(i));
  const todays = rest.filter((i) => istDay(Date.parse(i.due_at!)) <= today);
  const thisWeek = rest.filter((i) => istDay(Date.parse(i.due_at!)) > today && Date.parse(i.due_at!) <= weekEnd);
  const later = rest.filter((i) => Date.parse(i.due_at!) > weekEnd);
  const undated = shown.filter(isUndated).sort(byPosted);
  const unreadable = shown.filter(isUnreadable).sort(byPosted);
  const preReads = shown.filter(isMaterial).sort(byPosted);

  // Calendar: every dated item still to come, by its day (in IST).
  const days: CalendarDay[] = [];
  if (settings.view === "calendar") {
    const groups = new Map<string, Item[]>();
    for (const i of upcoming) {
      const key = istDay(Date.parse(i.due_at!));
      groups.set(key, [...(groups.get(key) ?? []), i]);
    }
    for (const [key, list] of groups) {
      days.push({
        key,
        count: list.length,
        important: list.some((i) => i.category === "placements"),
        cards: list.map((item) => <ItemCard key={item.id} item={item} now={now} />),
      });
    }
  }
  const undatedCount = undated.length + unreadable.length + preReads.length;

  return (
    <div className="flex flex-col gap-6">
      {header}
      <ViewControls hidden={settings.hidden} view={settings.view} hiddenCounts={hiddenCounts} />
      {shown.length === 0 && dismissed.length === 0 && (
        <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {empty}
        </p>
      )}
      {settings.view === "calendar" ? (
        <>
          <Calendar days={days} today={today} />
          {undatedCount > 0 && (
            <p className="text-sm text-zinc-500">
              {undatedCount} item{undatedCount === 1 ? " has" : "s have"} no date, so {undatedCount === 1 ? "it isn't" : "they aren't"}{" "}
              on the calendar: switch to List to see {undatedCount === 1 ? "it" : "them"}.
            </p>
          )}
        </>
      ) : (
        <>
          <Group title="Placements, next 7 days" items={pinned} now={now} />
          <Group title="Today" items={todays} now={now} />
          <Group title="This week" items={thisWeek} now={now} />
          <Folded title="Later this term" items={later} now={now} />
          <Group title="No date given" items={undated} now={now} />
          <Group title="Couldn't read: please check these emails" items={unreadable} now={now} />
          <Group title="Recent pre-reads (last 2 weeks)" items={preReads} now={now} />
        </>
      )}
      <Folded title="Dismissed (hidden, can be put back)" items={dismissed} now={now} />
      <p className="text-xs text-zinc-500">
        This list is put together automatically from your ticked Classroom courses and your campus emails, and it can
        miss things. The timetable isn&apos;t included yet, so keep an eye on that too.
      </p>
    </div>
  );
}
