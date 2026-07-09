// Evolution API client (WhatsApp via QR pairing — no Meta token needed).
// Docs: https://doc.evolution-api.com  (v2 REST)
import axios from "axios";

const BASE = (process.env.EVOLUTION_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const KEY = process.env.EVOLUTION_API_KEY || "";
const INSTANCE = process.env.EVOLUTION_INSTANCE || "impress3d";

const api = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: { apikey: KEY, "content-type": "application/json" },
});

function jidToNumber(jid = "") {
  return String(jid).split("@")[0];
}

// Create the instance if it doesn't exist yet (idempotent-ish).
export async function ensureInstance(webhookUrl) {
  try {
    await api.post("/instance/create", {
      instanceName: INSTANCE,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });
  } catch (e) {
    // 403/409 = already exists — fine.
    const code = e.response?.status;
    if (code && ![400, 403, 409].includes(code)) {
      console.warn("[evolution] create instance:", e.response?.data || e.message);
    }
  }
  if (webhookUrl) await setWebhook(webhookUrl);
}

// Point the instance's webhook at our server and subscribe to incoming messages.
export async function setWebhook(url) {
  const payloads = [
    // v2 shape
    { webhook: { enabled: true, url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } },
    // older shape
    { url, webhook_by_events: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] },
  ];
  for (const body of payloads) {
    try {
      await api.post(`/webhook/set/${INSTANCE}`, body);
      return true;
    } catch (e) {
      /* try next shape */
    }
  }
  console.warn("[evolution] setWebhook failed for both payload shapes");
  return false;
}

// Returns { state, qr } — qr is a data URI (or null when already connected).
export async function connect() {
  const res = await api.get(`/instance/connect/${INSTANCE}`);
  const d = res.data || {};
  let qr = d.base64 || d.qrcode?.base64 || d.qr || d.code || null;
  if (qr && typeof qr === "string" && !qr.startsWith("data:")) {
    // Evolution sometimes returns raw base64 without the data-uri prefix.
    if (/^[A-Za-z0-9+/=]+$/.test(qr.slice(0, 40))) qr = `data:image/png;base64,${qr}`;
  }
  return { state: d.instance?.state || d.state || "connecting", qr };
}

// Returns "open" | "connecting" | "close".
export async function connectionState() {
  try {
    const res = await api.get(`/instance/connectionState/${INSTANCE}`);
    return res.data?.instance?.state || res.data?.state || "close";
  } catch (e) {
    if (e.response?.status === 404) return "not_created";
    return "close";
  }
}

export async function logout() {
  try {
    await api.delete(`/instance/logout/${INSTANCE}`);
    return true;
  } catch (e) {
    console.warn("[evolution] logout:", e.response?.data || e.message);
    return false;
  }
}

// Send a text message. `to` may be a bare number or a full JID.
// WhatsApp privacy IDs (@lid) must be sent as the FULL JID — Evolution v2.3+
// routes them natively, but stripping to a bare number yields "exists:false".
export async function sendText(to, body) {
  if (!KEY) {
    console.warn("[evolution] EVOLUTION_API_KEY not set — skipping send");
    return { skipped: true };
  }
  const s = String(to);
  let number;
  if (s.includes("@lid")) number = s; // keep full LID JID
  else if (s.includes("@")) number = jidToNumber(s); // s.whatsapp.net -> bare number
  else number = s; // already a bare number
  const res = await api.post(`/message/sendText/${INSTANCE}`, {
    number,
    text: String(body).slice(0, 4096),
  });
  return res.data;
}

// Fetch the decrypted media (base64) for a media message. Returns {base64, mimetype, ...}.
export async function getMediaBase64(rawData) {
  const res = await api.post(`/chat/getBase64FromMediaMessage/${INSTANCE}`, { message: rawData });
  return res.data;
}

// Parse an incoming Evolution webhook body into a normalized message (or null).
export function parseIncoming(body) {
  const event = body?.event || body?.type;
  if (event && !/messages\.upsert|MESSAGES_UPSERT/i.test(event)) return null;
  const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
  if (!data) return null;
  const key = data.key || {};
  if (key.fromMe) return null; // ignore our own echoes
  const jid = key.remoteJid || "";
  if (jid.endsWith("@g.us") || jid.includes("broadcast")) return null; // skip groups/status
  const m = data.message || {};
  const text =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    "";

  // Media detection (image / audio / video / sticker / document).
  let mediaType = null, mime = "", ext = "";
  if (m.imageMessage) { mediaType = "image"; mime = m.imageMessage.mimetype || "image/jpeg"; ext = "jpg"; }
  else if (m.audioMessage) { mediaType = "audio"; mime = m.audioMessage.mimetype || "audio/ogg"; ext = "ogg"; }
  else if (m.videoMessage) { mediaType = "video"; mime = m.videoMessage.mimetype || "video/mp4"; ext = "mp4"; }
  else if (m.stickerMessage) { mediaType = "sticker"; mime = "image/webp"; ext = "webp"; }
  else if (m.documentMessage) { mediaType = "document"; mime = m.documentMessage.mimetype || "application/octet-stream"; ext = (m.documentMessage.fileName || "file").split(".").pop() || "bin"; }

  return {
    jid,
    number: jidToNumber(jid),
    name: data.pushName || "",
    text: (text || "").trim(),
    hasText: Boolean((text || "").trim()),
    mediaType,
    mime,
    ext,
    raw: data,
    id: key.id || "",
  };
}

export const meta = { BASE, INSTANCE };
