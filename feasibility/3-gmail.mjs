// Check 3: can we read the last 20 emails? Shows only date, sender and subject.
// Email bodies are not downloaded and nothing is saved.
import { google } from "googleapis";
import { getAuthClient, describeError } from "./auth.mjs";

const auth = await getAuthClient();
const gmail = google.gmail({ version: "v1", auth });

let messages;
try {
  const { data } = await gmail.users.messages.list({ userId: "me", maxResults: 20 });
  messages = data.messages ?? [];
} catch (e) {
  console.log(`BLOCKED listing emails: ${describeError(e)}`);
  process.exit(1);
}
console.log(`Emails fetched: ${messages.length}\n`);

for (const { id } of messages) {
  const { data: msg } = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "metadata",
    metadataHeaders: ["Date", "From", "Subject"],
  });
  const header = (name) => msg.payload.headers.find((h) => h.name === name)?.value ?? "";
  console.log(`${header("Date")}  |  ${header("From")}  |  ${header("Subject")}`);
}
