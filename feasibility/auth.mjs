// Shared sign-in helper for the Stage 1 feasibility scripts.
// Opens Google's sign-in page in your browser, then saves the result in
// secrets/token.json (ignored by Git) so the other scripts don't ask again.
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_FILE = path.join(here, "secrets", "client_secret.json");
const TOKEN_FILE = path.join(here, "secrets", "token.json");

// Read-only permissions, the same five listed on the consent screen.
export const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export async function getAuthClient({ fresh = false } = {}) {
  const { installed } = JSON.parse(fs.readFileSync(CLIENT_FILE, "utf8"));
  if (!fresh && fs.existsSync(TOKEN_FILE)) {
    const client = new google.auth.OAuth2(installed.client_id, installed.client_secret);
    client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")));
    return client;
  }
  if (!fresh) throw new Error("Not signed in yet. Run `npm run signin` first.");
  return signIn(installed);
}

// Google's error code plus message, which is what we need to record in the results.
export function describeError(e) {
  const reason = e.errors?.[0]?.reason ?? e.response?.data?.error?.status ?? "";
  return `${e.code ?? e.status ?? "?"} ${reason} - ${e.message}`.trim();
}

function signIn(installed) {
  const state = crypto.randomBytes(16).toString("hex");
  let client;

  return new Promise((resolve, reject) => {
    // A tiny one-time web server on your laptop that catches Google's reply.
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const error = url.searchParams.get("error");
      const ok = !error && url.searchParams.get("state") === state;
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(ok ? "Signed in. You can close this tab and go back to Claude." : `Sign-in failed: ${error ?? "state mismatch"}. You can close this tab.`);
      server.close();
      if (!ok) return reject(new Error(`Google returned: ${error ?? "state mismatch"}`));

      try {
        const { tokens } = await client.getToken(url.searchParams.get("code"));
        client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
        resolve(client);
      } catch (e) {
        reject(e);
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      client = new google.auth.OAuth2(installed.client_id, installed.client_secret, `http://127.0.0.1:${port}/callback`);
      const authUrl = client.generateAuthUrl({
        access_type: "offline",
        prompt: "select_account consent",
        scope: SCOPES,
        state,
      });
      console.log("Opening Google sign-in in your browser. If it doesn't open, paste this link:\n\n" + authUrl + "\n");
      exec(`start "" "${authUrl}"`);
    });
  });
}
