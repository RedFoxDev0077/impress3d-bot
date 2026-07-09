import "dotenv/config";
import express from "express";
import { promises as fsp } from "node:fs";
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
const MEDIA_DIR = path.join(process.cwd(), "data", "media");

const MIME_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/amr": "amr", "video/mp4": "mp4", "application/pdf": "pdf" };
const extFromMime = (mime = "") => MIME_EXT[String(mime).split(";")[0].trim()] || "";
function mediaAck(type) {
  return {
    image: "Recebi a sua imagem! 📷 Vou já analisar. Se puder, descreva em texto o que precisa (peça, tamanho, material) para adiantar o orçamento. 🙂",
    audio: "Recebi o seu áudio! 🎤 Um colega vai ouvir e responder-lhe em breve. Se preferir, pode também escrever a sua questão.",
    video: "Recebi o seu vídeo! 🎬 Vou analisar e responder-lhe em breve.",
    document: "Recebi o seu documento! 📄 Vou verificar e responder-lhe em breve.",
    sticker: "😄 Recebido! Em que posso ajudar com a sua impressão 3D?",
  }[type] || "Recebi a sua mensagem! Respondo-lhe já de seguida. 🙂";
}

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
async function handleInbound({ jid, name, text, hasText, id, mediaType, raw, ext }) {
  // ---- Media (image / audio / video / document / sticker) ----
  if (mediaType) {
    const label = { image: "📷 Imagem", audio: "🎤 Áudio", video: "🎬 Vídeo", sticker: "🃏 Figurinha", document: "📄 Documento" }[mediaType] || "📎 Mídia";
    let mediaFile = null;
    try {
      const md = await evolution.getMediaBase64(raw);
      if (md?.base64) {
        const e = extFromMime(md.mimetype) || ext || "bin";
        mediaFile = `${Date.now()}_${String(id).replace(/[^\w]/g, "").slice(0, 24)}.${e}`;
        await fsp.mkdir(MEDIA_DIR, { recursive: true });
        await fsp.writeFile(path.join(MEDIA_DIR, mediaFile), Buffer.from(md.base64, "base64"));
      }
    } catch (e) {
      console.warn("[media] fetch failed:", e.response?.data || e.message);
    }
    console.log(`[msg] ${jid} (${name}): <${mediaType}${mediaFile ? "" : " — download failed"}>${hasText ? " " + text : ""}`);
    await appendMessage(jid, "user", hasText ? text : label, name, { type: mediaType, media: mediaFile });
    const reply = mediaAck(mediaType);
    await appendMessage(jid, "assistant", reply);
    await sendText(jid, reply);
    return;
  }

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
  const hasAIKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!hasAIKey) {
    // Milestone 1: works with no paid API key — simple auto-reply. Upgrades to
    // full Claude replies automatically once ANTHROPIC_API_KEY is set.
    reply =
      process.env.SIMPLE_REPLY ||
      "Olá! 👋 Obrigado por contactar a *Impress3D*. Recebi a sua mensagem e a nossa equipa responde-lhe já de seguida. 🙂";
  } else {
    try {
      reply = await generateReply(history);
    } catch (e) {
      console.error("[ai] error:", e.response?.data || e.message);
      reply = "Peço desculpa, tive um problema técnico a processar a sua mensagem. Pode repetir, por favor?";
    }
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

// ---------- Media (customer images/audio), token-protected ----------
app.get("/media/:file", (req, res) => {
  try {
    if (!req.query.t || !crypto.timingSafeEqual(Buffer.from(String(req.query.t)), Buffer.from(issueToken()))) {
      return res.sendStatus(401);
    }
  } catch {
    return res.sendStatus(401);
  }
  const file = path.basename(String(req.params.file));
  res.sendFile(path.join(MEDIA_DIR, file), (err) => {
    if (err && !res.headersSent) res.sendStatus(404);
  });
});

// ---------- Static dashboard ----------
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString(), provider: WA_PROVIDER }));
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`impress3d-bot listening on 127.0.0.1:${PORT} (wa=${WA_PROVIDER}, ai=${process.env.AI_PROVIDER || "anthropic"})`);
});
