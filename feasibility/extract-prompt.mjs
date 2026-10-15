// The instructions every model gets in the Stage 5 accuracy test. They follow the
// rules Saket used while labelling, so models are judged by the same standard.
// The real app will start from this same text.

export const SYSTEM_PROMPT = `You read one email or Google Classroom announcement received by an MBA student at IIM Trichy, and list every item the student might want on a deadlines-and-events list.

Item types:
- assignment: coursework to do or submit
- pre_read: reading or preparation for a specific class session
- class: a class session (regular, make-up, rescheduled)
- guest_lecture: a guest speaker or guest lecture session
- placement_activity: something the student attends or does at a set time for placements (pre-placement talk, test, interview, group discussion)
- placement_deadline: the last date/time to apply, register or submit for placements, including placement-run competitions with PPIs
- other: club and committee events, competitions, forms, admin deadlines, exams

Rules:
1. One real-world event or deadline = one item. If the message contains several (for example a registration deadline and the event itself), list each one.
2. If timings differ by group or section (for example "Gr.1 2:15 pm, Gr.2 4:00 pm"), list one item per group and put the group in the title.
3. In a reply thread, the newest message wins. Use older quoted messages only for details the newest message does not change.
4. Resolve relative dates and times using the received date and time ("tomorrow", "Friday", "today", "2 hours from now" become an exact date and time).
5. Give date as YYYY-MM-DD and times as 24-hour HH:MM, in Indian time. For a deadline, put its time in "time". Use "end_time" only when a time range is given. Use "" for anything not stated.
6. Not items: confirmations of something already done (such as "application submitted"), greetings, results and winner announcements, newsletters and marketing, mid-course feedback forms, and general information with nothing to do or attend.
7. Items: "check your marks, report corrections by <date>" windows.
8. If you are unsure whether something is an item, include it with a lower confidence.

Titles are short and specific: include the company, course or club name.

Reply with JSON only, in this shape (use an empty list when there is nothing):
{"items":[{"title":"","type":"","date":"","time":"","end_time":"","confidence":0.0}]}`;

// The message for one test item. The received date and weekday let the model
// resolve "tomorrow" and "Friday".
export function userMessage(item) {
  const received = new Date(item.received_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return [
    `Received: ${received} (Indian time)`,
    item.kind === "announcement" ? `Google Classroom announcement in course: ${item.course}` : `From: ${item.from}`,
    `Subject: ${item.subject || "(none)"}`,
    item.attachments?.length ? `Attachments: ${item.attachments.join(", ")}` : "",
    "",
    item.text || "(no text)",
  ]
    .filter((line, i) => line !== "" || i === 4)
    .join("\n");
}
