// Simple file-backed conversation store, keyed by WhatsApp phone number.
// Fine for low/medium volume (receptive support). Swap for Supabase/Postgres
// later without touching the rest of the app — keep the same 4 functions.
import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "conversations.json");
const HISTORY_TURNS = parseInt(process.env.HISTORY_TURNS || "12", 10);

let cache = null;
let writing = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    cache = JSON.parse(raw);
  } catch {
    cache = {};
  }
  return cache;
}

async function persist() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const snapshot = JSON.stringify(cache, null, 2);
  // serialize writes to avoid interleaving
  writing = writing.then(() => fs.writeFile(FILE, snapshot, "utf-8"));
  return writing;
}

export async function getConversation(phone) {
  const db = await load();
  return db[phone] || { messages: [], meta: {} };
}

// Returns the last N messages as [{role, content}] for the model.
export async function getHistory(phone) {
  const conv = await getConversation(phone);
  return conv.messages.slice(-HISTORY_TURNS).map(({ role, content }) => ({ role, content }));
}

export async function appendMessage(phone, role, content) {
  const db = await load();
  if (!db[phone]) db[phone] = { messages: [], meta: {} };
  db[phone].messages.push({ role, content, ts: new Date().toISOString() });
  // keep file from growing unbounded: retain last 100 raw messages per user
  if (db[phone].messages.length > 100) {
    db[phone].messages = db[phone].messages.slice(-100);
  }
  await persist();
}

export async function setMeta(phone, patch) {
  const db = await load();
  if (!db[phone]) db[phone] = { messages: [], meta: {} };
  db[phone].meta = { ...db[phone].meta, ...patch };
  await persist();
}
