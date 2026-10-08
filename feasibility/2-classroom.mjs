// Check 2: can we read Classroom courses, assignments, materials and announcements?
// Shows up to 5 of the latest of each per course. Nothing is saved.
import { google } from "googleapis";
import { getAuthClient, describeError } from "./auth.mjs";

const auth = await getAuthClient();
const classroom = google.classroom({ version: "v1", auth });

let courses;
try {
  const { data } = await classroom.courses.list({ studentId: "me", courseStates: ["ACTIVE"], pageSize: 50 });
  courses = data.courses ?? [];
} catch (e) {
  console.log(`BLOCKED listing courses: ${describeError(e)}`);
  process.exit(1);
}
console.log(`Active courses: ${courses.length}`);

for (const course of courses) {
  console.log(`\n== ${course.name}`);
  await report("Assignments", () => classroom.courses.courseWork.list({ courseId: course.id, pageSize: 5 }), (d) => d.courseWork, (w) => `${w.title}  |  due ${formatDue(w)}`);
  await report("Materials", () => classroom.courses.courseWorkMaterials.list({ courseId: course.id, pageSize: 5 }), (d) => d.courseWorkMaterial, (m) => m.title);
  await report("Announcements", () => classroom.courses.announcements.list({ courseId: course.id, pageSize: 5 }), (d) => d.announcements, (a) => (a.text ?? "").split("\n")[0].slice(0, 80));
}

async function report(label, fetch, pick, line) {
  try {
    const items = pick((await fetch()).data) ?? [];
    console.log(`  ${label} (latest ${items.length}):`);
    for (const item of items) console.log(`    - ${line(item)}`);
  } catch (e) {
    console.log(`  ${label}: BLOCKED ${describeError(e)}`);
  }
}

// Classroom stores due times in UTC, not Indian time.
function formatDue(work) {
  if (!work.dueDate) return "(no due date)";
  const { year, month, day } = work.dueDate;
  const { hours = 0, minutes = 0 } = work.dueTime ?? {};
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)} UTC`;
}
