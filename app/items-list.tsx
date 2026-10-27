type Item = {
  id: string;
  source: string;
  source_id: string | null;
  type: string;
  title: string;
  course_name: string | null;
  sender: string | null;
  due_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  posted_at: string | null;
  details: string | null;
  link: string | null;
  status: string;
};

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
  const when = whenLabel(item, now);
  const possible = item.status === "needs_review" && !isUnreadable(item);
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <span className="break-all">{fromLabel(item)}</span>
        <span className="font-normal normal-case tracking-normal">· {TYPE_NAMES[item.type] ?? item.type}</span>
      </p>
      {possible && (
        <p className="self-start rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Possible deadline: confirm?
        </p>
      )}
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
    </li>
  );
}

function Group({ title, items, now }: { title: string; items: Item[]; now: number }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {title} <span className="font-normal text-zinc-500">({items.length})</span>
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} now={now} />
        ))}
      </ul>
    </section>
  );
}

// Everything found so far, from Classroom, emails and announcements, by date.
// Never claims to be complete (trust rule).
export function ItemsList({
  items,
  watching,
  reading,
  now,
}: {
  items: Item[];
  watching: string[] | null;
  reading: ReadingProgress | null;
  now: number;
}) {
  const byPosted = (a: Item, b: Item) => Date.parse(b.posted_at ?? "") - Date.parse(a.posted_at ?? "");
  // Classroom materials: no date, shown as "recent pre-reads" as before.
  const isMaterial = (i: Item) => i.source_id?.startsWith("material:") ?? false;
  // Still on: not yet due, or (for a session with an end time) not yet over.
  const upcoming = items
    .filter((i) => i.due_at && Date.parse(i.ends_at ?? i.due_at) >= now)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!));
  const unreadable = items.filter(isUnreadable).sort(byPosted);
  // Undated: Classroom assignments always; found items only if recent (old ones are noise).
  const undated = items
    .filter((i) => !i.due_at && !isMaterial(i) && !isUnreadable(i))
    .filter((i) => i.source_id?.startsWith("coursework:") || now - Date.parse(i.posted_at ?? "") <= RECENT_UNDATED_DAYS * DAY)
    .sort(byPosted);
  const preReads = items.filter(isMaterial).sort(byPosted);
  const waiting = reading ? reading.total - reading.done : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        {watching && (
          <p>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Watching:</span>{" "}
            {watching.length > 0 ? watching.join(", ") : "no courses ticked yet"}
          </p>
        )}
        {reading && reading.total > 0 && (
          <p>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Read so far:</span> {reading.done} of{" "}
            {reading.total} emails and announcements.
            {waiting > 0 &&
              ` The other ${waiting} will be read ${waiting > 40 ? "over the next day or two" : "within the next few hours"}; newest campus mail first.`}
          </p>
        )}
      </div>
      {items.length === 0 && (
        <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Nothing found yet in your ticked courses or emails.
        </p>
      )}
      <Group title="Coming up" items={upcoming} now={now} />
      <Group title="No date given" items={undated} now={now} />
      <Group title="Couldn't read: please check these emails" items={unreadable} now={now} />
      <Group title="Recent pre-reads (last 2 weeks)" items={preReads} now={now} />
      <p className="text-xs text-zinc-500">
        This list is put together automatically from your ticked Classroom courses and your campus emails, and it can
        miss things. The timetable isn&apos;t included yet, so keep an eye on that too.
      </p>
    </div>
  );
}
