// Categories for the Stage 6 filters (Saket, 2026-10-27): Placements and
// Competitions on by default, Clubs & committees off by default. Worked out from
// what's already stored (type, source, sender, title), so no AI change or re-test is
// needed, and a fix here applies to every item at once. Draft, awaiting Saket's check.

export type Category = "placements" | "courses" | "competitions" | "clubs" | "other";

export const CATEGORY_NAMES: Record<Category, string> = {
  placements: "Placements",
  courses: "Courses & classes",
  competitions: "Competitions",
  clubs: "Clubs & committees",
  other: "Other",
};

// Placement portals and the placement office's addresses.
const PLACEMENT_SENDERS = ["@edtex.in", "placement", "consulate@"];
// Academic offices and the class schedule (personal faculty addresses are caught by type).
const ACADEMIC_SENDERS = ["pgpm2y.staff@", "pgpmelectivesupport@", "aoacademics@", "no-reply-schedule@", "pgpoffice@"];
// Campus offices: practical notices, not clubs.
const OFFICE_SENDERS = ["saoffice@", "hosteloffice@", "librarian@", "admin@iimtrichy", "president-sc@", "pgpstudentrepresentative@"];
const COMPETITION_WORDS = /\b(competition|challenge|case ?comp|caseunion|ideathon|hackathon|b-?plan)\b/i;
// Competition platforms (Unstop sends round schedules, simulations, results).
const COMPETITION_SENDERS = ["unstop."];
const COURSE_TYPES = ["class", "assignment", "pre_read"];

type Categorisable = { source: string; type: string; title: string; sender: string | null };

export function categoryOf(item: Categorisable, collegeDomain = "iimtrichy.ac.in"): Category {
  const sender = item.sender?.toLowerCase() ?? "";
  const has = (list: string[]) => list.some((part) => sender.includes(part));

  if (item.type === "placement_deadline" || item.type === "placement_activity" || has(PLACEMENT_SENDERS)) {
    // A corporate competition sent by the placement side is still a competition.
    return COMPETITION_WORDS.test(item.title) ? "competitions" : "placements";
  }
  const courseType = COURSE_TYPES.includes(item.type) && !has(COMPETITION_SENDERS); // a round's "pre-read" on Unstop isn't a course
  if (item.source === "classroom" || courseType || has(ACADEMIC_SENDERS)) return "courses";
  if (has(OFFICE_SENDERS)) return COMPETITION_WORDS.test(item.title) ? "competitions" : "other";
  // A campus role address (culturalcommittee@, ecell@, arthaniti@): a club or committee.
  // Their competitions stay with them (Saket, 2026-11-12: Rangoli, DataZoids → Clubs).
  // Personal addresses (name.x@) are staff or students writing directly.
  const [local, domain] = sender.split("@");
  if (domain === collegeDomain && local && !/^[a-z]+\.[a-z]+$/.test(local) && !/^[a-z]+\.[a-z]$/.test(local)) {
    return "clubs";
  }
  // Everything else that's a competition: corporate ones forwarded by staff
  // (TrenDSetter, L'Oréal), Unstop rounds, outside organisers.
  if (COMPETITION_WORDS.test(item.title) || has(COMPETITION_SENDERS)) return "competitions";
  return "other";
}
