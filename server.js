import "dotenv/config";
import express from "express";
import { promises as fsp } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getConversation,
  getHistory,
  appendMessage,
  setMeta,
  setLabels,
  listConversations,
  getMessages,
  getStats,
  getSettings,
  setSettings,
} from "./src/store.js";
import { generateReply, readPrompt, writePrompt, visionMime, transcribeAudio } from "./src/ai.js";
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
const WEBHOOK_URL = `${PUBLIC_URL}/webhook/evolution`;

// Detects a price / quote request so those conversations get separated.
const QUOTE_RE = /\bor(ç|c)ament|quanto\s+(custa|fica|sai|é|e|seria)|qual\s+(o\s+)?(preç|prec|valor)|\bpre(ç|c)o|cota(ç|c)(ã|a)o|\bor(ç|c)ar|fa(z|ç)er?\s+(uma|um)\s+(pe(ç|c)a|impress|modelo)|imprimir\s+(uma|um|isso|este|esta)/i;

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

app.use(express.json({ limit: "16mb", verify: (req, _res, buf) => (req.rawBody = buf) }));

// Provider-agnostic send (instance-aware for Evolution).
async function sendText(instance, to, body) {
  return WA_PROVIDER === "meta" ? meta.sendText(to, body) : evolution.sendText(instance, to, body);
}

// Detects file links in an outgoing message so they go out as NATIVE media,
// not a bare URL. (e.g. the AI replies with a photo/video/audio/pdf link.)
const OUT_MEDIA_RE = /(https?:\/\/[^\s]+?\.(?:jpe?g|png|webp|gif|mp4|mov|m4v|mp3|ogg|m4a|wav|pdf|stl|obj|3mf|step|stp|zip))(?:\?[^\s]*)?/gi;
function urlMediaType(u) {
  const ext = u.split("?")[0].split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (["mp4", "mov", "m4v"].includes(ext)) return "video";
  if (["mp3", "ogg", "m4a", "wav"].includes(ext)) return "audio";
  return "document";
}
// Send text; if it contains file links, dispatch them as native WhatsApp media.
async function sendSmart(instance, to, text) {
  const urls = WA_PROVIDER === "evolution" ? String(text).match(OUT_MEDIA_RE) || [] : [];
  if (!urls.length) return sendText(instance, to, text);
  let caption = String(text);
  for (const u of urls) caption = caption.replace(u, "").trim();
  let first = true;
  for (const u of urls) {
    try { await evolution.sendMedia(instance, to, { url: u, type: urlMediaType(u), caption: first ? caption : "" }); first = false; }
    catch (e) { console.warn("[sendMedia] fallback to text:", e.response?.data || e.message); await sendText(instance, to, u); }
  }
  return { ok: true };
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

// Pause / resume the AI for one conversation (manual takeover).
app.post("/api/chats/:id/pause", requireAuth, async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const paused = Boolean(req.body?.paused);
  // Resuming clears both the manual pause and any auto-pause window.
  await setMeta(id, paused ? { paused: true } : { paused: false, pausedUntil: 0 });
  res.json({ ok: true, paused });
});

// Set the conversation's labels (tags).
app.post("/api/chats/:id/labels", requireAuth, async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const labels = await setLabels(id, req.body?.labels || []);
  res.json({ ok: true, labels });
});

// Send a manual message as the business (from the dashboard).
app.post("/api/chats/:id/send", requireAuth, async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "texto vazio" });
  try {
    const conv = await getConversation(id);
    const instance = conv.meta?.instance || evolution.meta.DEFAULT_INSTANCE;
    await sendSmart(instance, id, text);
    await appendMessage(id, "assistant", text, null, { agent: true });
    await autoPause(id);
    res.json({ ok: true });
  } catch (e) {
    console.error("[manual send]", e.response?.data || e.message);
    res.status(502).json({ error: "falha ao enviar mensagem" });
  }
});

// Agent sends a media file (image/audio/video/doc) from the dashboard.
app.post("/api/chats/:id/send-media", requireAuth, async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const { base64, url, type = "image", mime, fileName, caption } = req.body || {};
  if (!base64 && !url) return res.status(400).json({ error: "sem ficheiro" });
  try {
    const conv = await getConversation(id);
    const instance = conv.meta?.instance || evolution.meta.DEFAULT_INSTANCE;
    await evolution.sendMedia(instance, id, { base64, url, type, mime, fileName, caption });
    let mediaFile = null;
    if (base64) {
      const e = extFromMime(mime) || (type === "image" ? "jpg" : type === "audio" ? "ogg" : type === "video" ? "mp4" : "bin");
      mediaFile = `${Date.now()}_out.${e}`;
      await fsp.mkdir(MEDIA_DIR, { recursive: true });
      await fsp.writeFile(path.join(MEDIA_DIR, mediaFile), Buffer.from(base64, "base64"));
    }
    await appendMessage(id, "assistant", caption || "", null, { agent: true, type, media: mediaFile, fileName });
    await autoPause(id);
    res.json({ ok: true });
  } catch (e) {
    console.error("[send-media]", e.response?.data || e.message);
    res.status(502).json({ error: "falha ao enviar mídia" });
  }
});

// The AI is muted for a chat if manually paused OR inside the auto-pause window.
const isPaused = (m) => Boolean(m?.paused) || (m?.pausedUntil && m.pausedUntil > Date.now());
// After an agent replies, mute the AI for the configured window.
async function autoPause(id) {
  const mins = (await getSettings()).autoPauseMinutes || 0;
  if (mins > 0) await setMeta(id, { pausedUntil: Date.now() + mins * 60000 });
}

// ---------- Settings (auto-pause timer, etc.) ----------
app.get("/api/settings", requireAuth, async (_req, res) => res.json(await getSettings()));
app.post("/api/settings", requireAuth, async (req, res) => {
  const patch = {};
  if (req.body?.autoPauseMinutes !== undefined) {
    patch.autoPauseMinutes = Math.max(0, Math.min(1440, parseInt(req.body.autoPauseMinutes, 10) || 0));
  }
  res.json(await setSettings(patch));
});

// ---------- AI prompt training (editable per country) ----------
app.get("/api/prompt", requireAuth, async (req, res) => {
  const country = String(req.query.country || "pt").toLowerCase();
  res.json({ country, text: await readPrompt(country) });
});
app.post("/api/prompt", requireAuth, async (req, res) => {
  const country = String(req.body?.country || "").toLowerCase();
  if (!["pt", "br"].includes(country)) return res.status(400).json({ error: "país inválido" });
  await writePrompt(country, String(req.body?.text || ""));
  res.json({ ok: true });
});

// ---------- Connection (multi-number) ----------
app.get("/api/instances", requireAuth, async (_req, res) => {
  if (WA_PROVIDER !== "evolution") return res.json([{ id: "meta", label: "Meta", country: "", state: "n/a" }]);
  const list = evolution.getInstances();
  const out = await Promise.all(list.map(async (i) => ({ ...i, state: await evolution.connectionState(i.id) })));
  res.json(out);
});

app.get("/api/connection", requireAuth, async (req, res) => {
  if (WA_PROVIDER !== "evolution") return res.json({ provider: "meta", state: "n/a" });
  const instance = req.query.instance || evolution.meta.DEFAULT_INSTANCE;
  const state = await evolution.connectionState(instance);
  res.json({ provider: "evolution", instance, state });
});

app.post("/api/connection/connect", requireAuth, async (req, res) => {
  const instance = req.body?.instance || req.query.instance || evolution.meta.DEFAULT_INSTANCE;
  try {
    await evolution.ensureInstance(instance, WEBHOOK_URL);
    const { state, qr } = await evolution.connect(instance);
    res.json({ state, qr, instance });
  } catch (e) {
    console.error("[connect]", e.response?.data || e.message);
    res.status(502).json({ error: "não foi possível gerar o QR", detail: e.response?.data || e.message });
  }
});

app.post("/api/connection/logout", requireAuth, async (req, res) => {
  const instance = req.body?.instance || req.query.instance || evolution.meta.DEFAULT_INSTANCE;
  res.json({ ok: await evolution.logout(instance) });
});

// ---------- WhatsApp: Evolution webhook ----------
// Generate an AI reply from the conversation history and send it on the right number.
async function aiReplyAndSend(instance, jid, country, opts = {}) {
  const history = await getHistory(jid);
  let reply;
  const hasAIKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!hasAIKey) {
    reply = process.env.SIMPLE_REPLY || "Olá! 👋 Obrigado por contactar a *Impress3D*. Recebi a sua mensagem e a nossa equipa responde-lhe já de seguida. 🙂";
  } else {
    try {
      reply = await generateReply(history, { country, ...opts });
    } catch (e) {
      console.error("[ai] error:", e.response?.data || e.message);
      reply = "Peço desculpa, tive um problema técnico a processar a sua mensagem. Pode repetir, por favor?";
    }
  }
  await appendMessage(jid, "assistant", reply);
  await sendSmart(instance, jid, reply);
}

async function handleInbound({ instance, jid, name, text, hasText, id, mediaType, raw, ext, fileName }) {
  instance = instance || evolution.meta.DEFAULT_INSTANCE;
  const country = evolution.countryOf(instance);
  const conv = await getConversation(jid);
  const paused = isPaused(conv.meta);
  // Record which number/country this conversation belongs to.
  await setMeta(jid, { instance, country, number: conv.meta?.number || jid.split("@")[0] });

  // ---- Media (image / audio / video / document / sticker) ----
  if (mediaType) {
    const label = { image: "📷 Imagem", audio: "🎤 Áudio", video: "🎬 Vídeo", sticker: "🃏 Figurinha", document: "📄 Documento" }[mediaType] || "📎 Mídia";
    let mediaFile = null, mediaB64 = null, mediaMime = "";
    try {
      const md = await evolution.getMediaBase64(instance, raw);
      if (md?.base64) {
        mediaB64 = md.base64;
        mediaMime = md.mimetype || "";
        const e = extFromMime(md.mimetype) || ext || "bin";
        mediaFile = `${Date.now()}_${String(id).replace(/[^\w]/g, "").slice(0, 24)}.${e}`;
        await fsp.mkdir(MEDIA_DIR, { recursive: true });
        await fsp.writeFile(path.join(MEDIA_DIR, mediaFile), Buffer.from(md.base64, "base64"));
      }
    } catch (e) {
      console.warn("[media] fetch failed:", e.response?.data || e.message);
    }
    // Audio → Whisper transcription (when an OpenAI key is set).
    let transcript = "";
    if (mediaType === "audio" && mediaB64 && process.env.OPENAI_API_KEY) {
      try { transcript = await transcribeAudio(mediaB64, mediaMime || "audio/ogg"); console.log(`[whisper] ${jid}: "${transcript.slice(0, 80)}"`); }
      catch (e) { console.warn("[whisper] failed:", e.message); }
    }

    console.log(`[msg:${instance}] ${jid} (${name}): <${mediaType}${fileName ? " " + fileName : ""}${mediaFile ? "" : " — download failed"}>${hasText ? " " + text : ""}`);
    const shown = mediaType === "document" ? `📎 Ficheiro: ${fileName || "documento"}${ext ? ` (.${ext})` : ""}`
      : mediaType === "audio" && transcript ? `🎤 ${transcript}`
      : label;
    const content = mediaType === "document" ? (hasText ? `${shown} — ${text}` : shown)
      : mediaType === "audio" ? shown
      : (hasText ? text : shown);
    await appendMessage(jid, "user", content, name, { type: mediaType, media: mediaFile, fileName, transcript: transcript || undefined });
    if (paused) return;

    const hasAI = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;

    if (mediaType === "document") {
      // A file usually means a quote — tag it and let the AI validate the format on the spot.
      const labels = new Set(conv.meta?.labels || []); labels.add("Orçamentos");
      await setMeta(jid, { quote: true, labels: [...labels] });
      await aiReplyAndSend(instance, jid, country);
      return;
    }

    // Vision — the AI actually looks at the customer's photo of the part.
    if ((mediaType === "image" || mediaType === "sticker") && mediaB64 && hasAI && mediaB64.length < 4_500_000) {
      console.log(`[vision] analysing image for ${jid} (${Math.round(mediaB64.length / 1024)} KB b64)`);
      await aiReplyAndSend(instance, jid, country, { image: { base64: mediaB64, mime: visionMime(mediaMime) } });
      return;
    }

    // Audio with a transcript → let the AI answer the spoken question.
    if (mediaType === "audio" && transcript && hasAI) {
      await aiReplyAndSend(instance, jid, country);
      return;
    }

    const reply = mediaAck(mediaType);
    await appendMessage(jid, "assistant", reply);
    await sendSmart(instance, jid, reply);
    return;
  }

  if (!hasText) {
    if (!paused) await sendText(instance, jid, "De momento consigo responder a mensagens de texto. Pode escrever a sua questão? 🙂");
    return;
  }
  console.log(`[msg:${instance}] ${jid} (${name}): ${text}${paused ? " [IA pausada]" : ""}`);
  await appendMessage(jid, "user", text, name);

  // Auto-separate quote requests with an "Orçamento" label.
  if (QUOTE_RE.test(text)) {
    const labels = new Set(conv.meta?.labels || []);
    labels.add("Orçamentos");
    await setMeta(jid, { quote: true, labels: [...labels] });
  }

  if (text.toLowerCase().includes(HANDOFF_KEYWORD)) {
    await setMeta(jid, { handoff: true, handoffAt: new Date().toISOString(), paused: true });
    if (!paused) await sendText(instance, jid, "Sem problema — vou encaminhar para um colega da equipa. Aguarde só um momento. 👍");
    return;
  }

  if (paused) return; // manual takeover — an agent replies from the dashboard
  await aiReplyAndSend(instance, jid, country);
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
    await handleInbound({ instance: evolution.meta.DEFAULT_INSTANCE, jid, name, text, hasText: Boolean(text), id: msg.id });
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
  // Ensure every configured number exists and points its webhook at us.
  if (WA_PROVIDER === "evolution") {
    for (const i of evolution.getInstances()) {
      evolution.ensureInstance(i.id, WEBHOOK_URL).catch(() => {});
    }
  }
});
