// File-backed conversation store, keyed by WhatsApp JID/number.
// Fine for low/medium volume. Swap for Supabase/Postgres later without
// touching the rest of the app — keep the same public functions.
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
    cache = JSON.parse(await fs.readFile(FILE, "utf-8"));
  } catch {
    cache = {};
  }
  return cache;
}

async function persist() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const snapshot = JSON.stringify(cache, null, 2);
  writing = writing.then(() => fs.writeFile(FILE, snapshot, "utf-8"));
  return writing;
}

export async function getConversation(id) {
  const db = await load();
  return db[id] || { messages: [], meta: {} };
}

export async function getHistory(id) {
  const conv = await getConversation(id);
  return conv.messages.slice(-HISTORY_TURNS).map(({ role, content }) => ({ role, content }));
}

export async function appendMessage(id, role, content, name, extra = {}) {
  const db = await load();
  if (!db[id]) db[id] = { messages: [], meta: {} };
  if (name && !db[id].meta.name) db[id].meta.name = name;
  db[id].meta.updatedAt = new Date().toISOString();
  db[id].messages.push({ role, content, ts: new Date().toISOString(), ...extra });
  if (db[id].messages.length > 200) db[id].messages = db[id].messages.slice(-200);
  await persist();
}

export async function setMeta(id, patch) {
  const db = await load();
  if (!db[id]) db[id] = { messages: [], meta: {} };
  db[id].meta = { ...db[id].meta, ...patch };
  await persist();
}

// ---- Dashboard helpers ----

// List conversations, most-recently-active first.
export async function listConversations() {
  const db = await load();
  return Object.entries(db)
    .map(([id, conv]) => {
      const last = conv.messages[conv.messages.length - 1];
      return {
        id,
        number: id.split("@")[0],
        name: conv.meta?.name || "",
        handoff: Boolean(conv.meta?.handoff),
        paused: Boolean(conv.meta?.paused),
        lastMessage: last?.content || "",
        lastRole: last?.role || "",
        lastTs: conv.meta?.updatedAt || last?.ts || null,
        count: conv.messages.length,
      };
    })
    .sort((a, b) => new Date(b.lastTs || 0) - new Date(a.lastTs || 0));
}

export async function getMessages(id, limit = 200) {
  const conv = await getConversation(id);
  return {
    id,
    number: id.split("@")[0],
    name: conv.meta?.name || "",
    handoff: Boolean(conv.meta?.handoff),
    paused: Boolean(conv.meta?.paused),
    messages: conv.messages.slice(-limit),
  };
}

// Aggregate stats for the dashboard KPIs and charts.
export async function getStats() {
  const db = await load();
  const convs = Object.values(db);
  let userMsgs = 0;
  let botMsgs = 0;
  const monthCounts = {}; // "YYYY-MM" -> user messages
  const dayCounts = {}; // last 12 months buckets built below
  const now = new Date();
  let activeToday = 0;
  const todayKey = now.toISOString().slice(0, 10);

  for (const conv of convs) {
    let activeTodayFlag = false;
    for (const m of conv.messages) {
      if (m.role === "user") {
        userMsgs++;
        const mk = (m.ts || "").slice(0, 7);
        if (mk) monthCounts[mk] = (monthCounts[mk] || 0) + 1;
        if ((m.ts || "").slice(0, 10) === todayKey) activeTodayFlag = true;
      } else if (m.role === "assistant") {
        botMsgs++;
      }
    }
    if (activeTodayFlag) activeToday++;
  }

  // Build a 12-month series ending this month.
  const series = [];
  const labels = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    labels.push(d.toLocaleString("en", { month: "short" }));
    series.push(monthCounts[key] || 0);
  }

  const totalUsers = convs.length;
  // "new" = first message within last 30 days
  let newUsers = 0;
  const cutoff = new Date(now.getTime() - 30 * 864e5);
  for (const conv of convs) {
    const first = conv.messages[0];
    if (first && new Date(first.ts) >= cutoff) newUsers++;
  }
  const returning = Math.max(totalUsers - newUsers, 0);

  return {
    totalQueries: userMsgs,
    totalReplies: botMsgs,
    totalUsers,
    activeToday,
    newUsers,
    returning,
    successRate: userMsgs ? Math.round((botMsgs / userMsgs) * 100) : 0,
    chart: { labels, series },
  };
}
