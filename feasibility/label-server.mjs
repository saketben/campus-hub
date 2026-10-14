// Stage 5, step 3: a tiny labelling page at http://localhost:4000 (this laptop only).
// Shows one test item at a time; Saket records the real deadlines/events in it.
// Labels are saved to secrets/testset/labels.json after every item.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, "secrets", "testset");
const ITEMS = path.join(DIR, "items.json");
const LABELS = path.join(DIR, "labels.json");

const items = JSON.parse(fs.readFileSync(ITEMS, "utf8"));
const labels = fs.existsSync(LABELS) ? JSON.parse(fs.readFileSync(LABELS, "utf8")) : {};

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Label test emails</title>
<style>
  :root { color-scheme: light dark; --b: #8884; }
  body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 860px; padding: 16px; line-height: 1.45; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .meta { font-size: 14px; opacity: .8; } .tag { border: 1px solid var(--b); border-radius: 6px; padding: 1px 6px; font-size: 12px; }
  pre { white-space: pre-wrap; word-break: break-word; border: 1px solid var(--b); border-radius: 8px; padding: 12px; max-height: 45vh; overflow: auto; font: 14px/1.45 system-ui, sans-serif; }
  .row { display: grid; grid-template-columns: 2fr 1.3fr 1fr .8fr auto; gap: 6px; margin: 6px 0; }
  @media (max-width: 640px) { .row { grid-template-columns: 1fr 1fr; } }
  input, select, button { font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--b); }
  button { cursor: pointer; } .primary { background: #2563eb; color: white; border: 0; } .none { background: #16a34a; color: white; border: 0; }
  .bar { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; } .hint { font-size: 13px; opacity: .75; }
</style></head><body>
<header><h2 style="margin:8px 0">Label test emails</h2><span id="progress" class="meta"></span></header>
<p class="hint">For each item, add every <b>real</b> deadline or event a student would want on their list
(title, type, date, and time if given). If there's nothing to act on, click <b>Nothing here</b>.
Use the email's own date to turn "tomorrow" into a real date.</p>
<div id="item"></div>
<h3>Items in this email</h3>
<div id="rows"></div>
<div class="bar">
  <button onclick="addRow()">+ Add another item</button>
  <button class="primary" onclick="save(false)">Save &amp; next →</button>
  <button class="none" onclick="save(true)">Nothing here →</button>
  <button onclick="go(-1)">← Back</button>
  <button onclick="nextUnlabelled()">Jump to next unlabelled</button>
</div>
<script>
const TYPES = ["assignment","pre_read","class","guest_lecture","placement_activity","placement_deadline","other"];
let items = [], labels = {}, i = 0;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function load() {
  ({ items, labels } = await (await fetch("/data")).json());
  nextUnlabelled();
}
function nextUnlabelled() { const j = items.findIndex((x) => !labels[x.id]); i = j === -1 ? 0 : j; show(); }
function go(d) { i = Math.max(0, Math.min(items.length - 1, i + d)); show(); }
function show() {
  const it = items[i], done = Object.keys(labels).length;
  document.getElementById("progress").textContent = "Item " + (i + 1) + " of " + items.length + " · " + done + " labelled";
  const when = new Date(it.received_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  document.getElementById("item").innerHTML =
    '<p class="meta"><span class="tag">' + esc(it.kind === "announcement" ? "Classroom: " + it.course : it.group === "important" ? (it.to_me_personally ? "to you personally" : "batch / group") : "other sender") + "</span> " +
    esc(when) + (it.from ? " · " + esc(it.from) : "") + ' · <a href="' + esc(it.link) + '" target="_blank" rel="noopener">open original ↗</a></p>' +
    "<h3>" + esc(it.subject || "(no subject)") + "</h3>" +
    (it.attachments?.length ? '<p class="meta">Attachments: ' + esc(it.attachments.join(", ")) + "</p>" : "") +
    "<pre>" + esc(it.text || "(no text)") + "</pre>";
  const rows = document.getElementById("rows"); rows.innerHTML = "";
  const saved = labels[it.id]?.items ?? [];
  (saved.length ? saved : [{}]).forEach(addRow);
}
function addRow(v = {}) {
  const d = document.createElement("div"); d.className = "row";
  d.innerHTML = '<input placeholder="Title, e.g. Axis Bank PPT" value="' + esc(v.title) + '">' +
    "<select>" + TYPES.map((t) => "<option" + (v.type === t ? " selected" : "") + ">" + t + "</option>").join("") + "</select>" +
    '<input type="date" value="' + esc(v.date) + '"><input type="time" value="' + esc(v.time) + '">' +
    '<button title="Remove" onclick="this.parentElement.remove()">✕</button>';
  document.getElementById("rows").appendChild(d);
}
async function save(none) {
  const rows = [...document.querySelectorAll("#rows .row")].map((r) => {
    const [title, type, date, time] = r.querySelectorAll("input, select");
    return { title: title.value.trim(), type: type.value, date: date.value, time: time.value };
  }).filter((r) => r.title);
  if (!none && rows.length === 0) { alert('Add at least one item with a title, or click "Nothing here".'); return; }
  labels[items[i].id] = { items: none ? [] : rows, labelled_at: new Date().toISOString() };
  await fetch("/label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: items[i].id, label: labels[items[i].id] }) });
  if (Object.keys(labels).length === items.length) alert("All " + items.length + " labelled. Thank you! You can close this tab.");
  nextUnlabelled();
}
load();
</script></body></html>`;

http
  .createServer((req, res) => {
    if (req.url === "/data") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ items, labels }));
    }
    if (req.url === "/label" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const { id, label } = JSON.parse(body);
        labels[id] = label;
        fs.writeFileSync(LABELS, JSON.stringify(labels, null, 2));
        res.writeHead(204).end();
      });
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page);
  })
  .listen(4000, "127.0.0.1", () => console.log("Labelling page: http://localhost:4000 (this laptop only)"));
