type Item = {
  id: string;
  type: string;
  title: string;
  course_name: string | null;
  due_at: string | null;
  all_day: boolean;
  posted_at: string | null;
  details: string | null;
  link: string | null;
};

const IST = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;

function dueLabel(item: Item, now: number) {
  if (!item.due_at) return null;
  const due = new Date(item.due_at);
  const date = due.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
  const time = due.toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
  const days = Math.floor((due.getTime() - now) / DAY);
  const soon = days < 1 ? "due within a day" : days < 7 ? `in ${days} day${days === 1 ? "" : "s"}` : null;
  return { text: item.all_day ? `Due ${date}` : `Due ${date}, ${time}`, soon };
}

function postedLabel(item: Item) {
  if (!item.posted_at) return null;
  return `Posted ${new Date(item.posted_at).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" })}`;
}

function ItemCard({ item, now }: { item: Item; now: number }) {
  const due = item.type === "assignment" ? dueLabel(item, now) : null;
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{item.course_name}</p>
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {due ? (
          <>
            {due.text}
            {due.soon && <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">{due.soon}</span>}
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
          Open in Classroom ↗
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

// The student's Classroom items in three groups. Never claims to be complete (trust rule).
export function ItemsList({ items, now }: { items: Item[]; now: number }) {
  const upcoming = items
    .filter((i) => i.type === "assignment" && i.due_at)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!));
  const undated = items.filter((i) => i.type === "assignment" && !i.due_at);
  const preReads = items
    .filter((i) => i.type === "pre_read")
    .sort((a, b) => Date.parse(b.posted_at ?? "") - Date.parse(a.posted_at ?? ""));

  return (
    <div className="flex flex-col gap-6">
      {items.length === 0 && (
        <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          No upcoming assignments or recent pre-reads in your ticked courses right now.
        </p>
      )}
      <Group title="Upcoming deadlines" items={upcoming} now={now} />
      <Group title="No due date set" items={undated} now={now} />
      <Group title="Recent pre-reads (last 2 weeks)" items={preReads} now={now} />
      <p className="text-xs text-zinc-500">
        This list only covers assignments and materials from your ticked Classroom courses. Classroom
        announcements, emails and the timetable aren&apos;t included yet, so keep an eye on those too.
      </p>
    </div>
  );
}
