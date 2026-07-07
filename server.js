import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getHistory,
  appendMessage,
  setMeta,
  listConversations,
  getMessages,
  getStats,
} from "./src/store.js";
import { generateReply } from "./src/ai.js";
import * as evolution from "./src/evolution.js";
import * as meta from "./src/whatsapp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const WA_PROVIDER = (process.env.WA_PROVIDER || "evolution").toLowerCase();
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const HANDOFF_KEYWORD = (process.env.HUMAN_HANDOFF_KEYWORD || "atendente").toLowerCase();
const DASH_PASSWORD = process.env.DASHBOARD_PASSWORD || "impress3d";
const DASH_SECRET = process.env.DASHBOARD_SECRET || VERIFY_TOKEN || "change-me-secret";
const PUBLIC_URL = process.env.PUBLIC_URL || "https://api.impress3d.com.br";

app.use(express.json({ limit: "2mb", verify: (req, _res, buf) => (req.rawBody = buf) }));

// Provider-agnostic send.
async function sendText(to, body) {
  return WA_PROVIDER === "meta" ? meta.sendText(to, body) : evolution.sendText(to, body);
}

// ---------- Auth (single admin) ----------
function issueToken() {
  return crypto.createHmac("sha256", DASH_SECRET).update("impress3d-admin").digest("hex");
}
function requireAuth(req, res, next) {
  const tok = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    if (tok && crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(issueToken()))) return next();
  } catch {}
  return res.status(401).json({ error: "unauthorized" });
}

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (password && password === DASH_PASSWORD) return res.json({ token: issueToken() });
  return res.status(401).json({ error: "senha incorreta" });
});

// ---------- Dashboard API ----------
app.get("/api/stats", requireAuth, async (_req, res) => res.json(await getStats()));
app.get("/api/chats", requireAuth, async (_req, res) => res.json(await listConversations()));
app.get("/api/chats/:id", requireAuth, async (req, res) =>
  res.json(await getMessages(decodeURIComponent(req.params.id)))
);

app.get("/api/connection", requireAuth, async (_req, res) => {
  if (WA_PROVIDER !== "evolution") return res.json({ provider: "meta", state: "n/a" });
  const state = await evolution.connectionState();
  res.json({ provider: "evolution", instance: evolution.meta.INSTANCE, state });
});

app.post("/api/connection/connect", requireAuth, async (_req, res) => {
  try {
    await evolution.ensureInstance(`${PUBLIC_URL}/webhook/evolution`);
    const { state, qr } = await evolution.connect();
    res.json({ state, qr });
  } catch (e) {
    console.error("[connect]", e.response?.data || e.message);
    res.status(502).json({ error: "não foi possível gerar o QR", detail: e.response?.data || e.message });
  }
});

app.post("/api/connection/logout", requireAuth, async (_req, res) => {
  res.json({ ok: await evolution.logout() });
});

// ---------- WhatsApp: Evolution webhook ----------
async function handleInbound({ jid, name, text, hasText, id }) {
  if (!hasText) {
    await sendText(jid, "De momento consigo responder a mensagens de texto. Pode escrever a sua questão? 🙂");
    return;
  }
  console.log(`[msg] ${jid} (${name}): ${text}`);

  if (text.toLowerCase().includes(HANDOFF_KEYWORD)) {
    await setMeta(jid, { handoff: true, handoffAt: new Date().toISOString() });
    await appendMessage(jid, "user", text, name);
    await sendText(jid, "Sem problema — vou encaminhar para um colega da equipa. Aguarde só um momento. 👍");
    return;
  }

  await appendMessage(jid, "user", text, name);
  const history = await getHistory(jid);
  let reply;
  try {
    reply = await generateReply(history);
  } catch (e) {
    console.error("[ai] error:", e.response?.data || e.message);
    reply = "Peço desculpa, tive um problema técnico a processar a sua mensagem. Pode repetir, por favor?";
  }
  await appendMessage(jid, "assistant", reply);
  await sendText(jid, reply);
}

app.post("/webhook/evolution", async (req, res) => {
  res.sendStatus(200); // ack fast
  try {
    const parsed = evolution.parseIncoming(req.body);
    if (parsed) await handleInbound(parsed);
  } catch (e) {
    console.error("[webhook/evolution] error:", e);
  }
});

// ---------- WhatsApp: Meta webhook (kept for optional official API) ----------
app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  return res.sendStatus(403);
});
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const change = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    if (!msg) return;
    const jid = msg.from;
    const name = change?.contacts?.[0]?.profile?.name || "";
    const text = msg.type === "text" ? msg.text.body.trim() : "";
    await handleInbound({ jid, name, text, hasText: Boolean(text), id: msg.id });
  } catch (e) {
    console.error("[webhook meta] error:", e);
  }
});

// ---------- Static dashboard ----------
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString(), provider: WA_PROVIDER }));
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`impress3d-bot listening on 127.0.0.1:${PORT} (wa=${WA_PROVIDER}, ai=${process.env.AI_PROVIDER || "anthropic"})`);
});
