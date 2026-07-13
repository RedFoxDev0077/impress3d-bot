// Evolution API client (WhatsApp via QR pairing — no Meta token needed).
// Multi-instance: supports several WhatsApp numbers (e.g. Portugal + Brasil).
// Docs: https://doc.evolution-api.com  (v2 REST)
import axios from "axios";

const BASE = (process.env.EVOLUTION_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const KEY = process.env.EVOLUTION_API_KEY || "";
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE || "impress3d";

const api = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: { apikey: KEY, "content-type": "application/json" },
});

const jidToNumber = (jid = "") => String(jid).split("@")[0];

// The configured WhatsApp numbers. Override with WA_INSTANCES (JSON) in .env.
export function getInstances() {
  try {
    const j = JSON.parse(process.env.WA_INSTANCES || "");
    if (Array.isArray(j) && j.length) return j;
  } catch {}
  return [
    { id: DEFAULT_INSTANCE, country: "pt", label: "Portugal", flag: "🇵🇹" },
    { id: process.env.INSTANCE_BR || "impress3d_br", country: "br", label: "Brasil", flag: "🇧🇷" },
  ];
}
export const instanceById = (id) => getInstances().find((i) => i.id === id) || getInstances()[0];
export const countryOf = (id) => (instanceById(id)?.country || "pt");

// Create the instance if it doesn't exist yet, and point its webhook at us.
export async function ensureInstance(instance, webhookUrl) {
  try {
    await api.post("/instance/create", { instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" });
  } catch (e) {
    const code = e.response?.status;
    if (code && ![400, 403, 409].includes(code)) console.warn("[evolution] create:", e.response?.data || e.message);
  }
  if (webhookUrl) await setWebhook(instance, webhookUrl);
}

export async function setWebhook(instance, url) {
  const payloads = [
    { webhook: { enabled: true, url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } },
    { url, webhook_by_events: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] },
  ];
  for (const body of payloads) {
    try { await api.post(`/webhook/set/${instance}`, body); return true; } catch {}
  }
  return false;
}

// Returns { state, qr } — qr is a data URI (or null when already connected).
export async function connect(instance) {
  const res = await api.get(`/instance/connect/${instance}`);
  const d = res.data || {};
  let qr = d.base64 || d.qrcode?.base64 || d.qr || d.code || null;
  if (qr && typeof qr === "string" && !qr.startsWith("data:") && /^[A-Za-z0-9+/=]+$/.test(qr.slice(0, 40))) {
    qr = `data:image/png;base64,${qr}`;
  }
  return { state: d.instance?.state || d.state || "connecting", qr };
}

export async function connectionState(instance) {
  try {
    const res = await api.get(`/instance/connectionState/${instance}`);
    return res.data?.instance?.state || res.data?.state || "close";
  } catch (e) {
    return e.response?.status === 404 ? "not_created" : "close";
  }
}

export async function logout(instance) {
  try { await api.delete(`/instance/logout/${instance}`); return true; }
  catch (e) { console.warn("[evolution] logout:", e.response?.data || e.message); return false; }
}

// Send a text message. `to` may be a bare number or a full JID.
// WhatsApp privacy IDs (@lid) must be sent as the FULL JID — Evolution v2.3+
// routes them natively; stripping to a bare number yields "exists:false".
export async function sendText(instance, to, body) {
  if (!KEY) { console.warn("[evolution] EVOLUTION_API_KEY not set — skipping send"); return { skipped: true }; }
  const s = String(to);
  const number = s.includes("@lid") ? s : s.includes("@") ? jidToNumber(s) : s;
  const res = await api.post(`/message/sendText/${instance}`, { number, text: String(body).slice(0, 4096) });
  return res.data;
}

// Fetch decrypted media (base64) for a media message.
export async function getMediaBase64(instance, rawData) {
  const res = await api.post(`/chat/getBase64FromMediaMessage/${instance}`, { message: rawData });
  return res.data;
}

// Parse an incoming Evolution webhook body into a normalized message (or null).
export function parseIncoming(body) {
  const event = body?.event || body?.type;
  if (event && !/messages\.upsert|MESSAGES_UPSERT/i.test(event)) return null;
  const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
  if (!data) return null;
  const key = data.key || {};
  if (key.fromMe) return null;
  const jid = key.remoteJid || "";
  if (jid.endsWith("@g.us") || jid.includes("broadcast")) return null;
  const m = data.message || {};
  const text = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || m.documentMessage?.caption || "";

  let mediaType = null, mime = "", ext = "";
  if (m.imageMessage) { mediaType = "image"; mime = m.imageMessage.mimetype || "image/jpeg"; ext = "jpg"; }
  else if (m.audioMessage) { mediaType = "audio"; mime = m.audioMessage.mimetype || "audio/ogg"; ext = "ogg"; }
  else if (m.videoMessage) { mediaType = "video"; mime = m.videoMessage.mimetype || "video/mp4"; ext = "mp4"; }
  else if (m.stickerMessage) { mediaType = "sticker"; mime = "image/webp"; ext = "webp"; }
  else if (m.documentMessage) { mediaType = "document"; mime = m.documentMessage.mimetype || "application/octet-stream"; ext = (m.documentMessage.fileName || "file").split(".").pop() || "bin"; }

  return {
    instance: body.instance || DEFAULT_INSTANCE,
    jid,
    number: jidToNumber(jid),
    name: data.pushName || "",
    text: (text || "").trim(),
    hasText: Boolean((text || "").trim()),
    mediaType, mime, ext,
    raw: data,
    id: key.id || "",
  };
}

export const meta = { BASE, DEFAULT_INSTANCE };
