// AI provider abstraction. Supports Anthropic (Claude) and OpenAI.
// Switch with AI_PROVIDER=anthropic|openai in .env.
import axios from "axios";
import { promises as fs } from "node:fs";
import path from "node:path";

const PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
const promptCache = new Map(); // country -> text

// Prompts edited in the dashboard are saved here (deploy-safe, gitignored).
// The committed defaults under prompts/ are the fallback / starting point.
const DATA_PROMPTS = path.resolve(process.cwd(), "data", "prompts");
const DEFAULT_PROMPTS = path.resolve(process.cwd(), "prompts");
const FALLBACK = "You are a helpful WhatsApp assistant for a 3D printing company. Reply in the customer's language.";

// Ordered lookup: per-country override → per-country default → generic override → generic default.
function promptCandidates(country) {
  const cc = String(country || "").toLowerCase();
  const names = [cc && `system.${cc}.md`, "system.md"].filter(Boolean);
  const out = [];
  for (const n of names) { out.push(path.join(DATA_PROMPTS, n)); out.push(path.join(DEFAULT_PROMPTS, n)); }
  return out;
}

export function clearPromptCache() { promptCache.clear(); }

// System prompt in effect for a country (cached).
export async function systemPrompt(country = "") {
  const key = String(country || "").toLowerCase() || "_";
  if (promptCache.has(key)) return promptCache.get(key);
  for (const p of promptCandidates(country)) {
    try { const txt = await fs.readFile(p, "utf-8"); promptCache.set(key, txt); return txt; } catch {}
  }
  promptCache.set(key, FALLBACK);
  return FALLBACK;
}

// Raw prompt text currently in effect (for the dashboard editor).
export async function readPrompt(country = "") {
  for (const p of promptCandidates(country)) {
    try { return await fs.readFile(p, "utf-8"); } catch {}
  }
  return "";
}

// Save an edited prompt as a deploy-safe override under data/prompts/.
export async function writePrompt(country, text) {
  const cc = String(country || "").toLowerCase();
  const name = cc ? `system.${cc}.md` : "system.md";
  await fs.mkdir(DATA_PROMPTS, { recursive: true });
  await fs.writeFile(path.join(DATA_PROMPTS, name), String(text), "utf-8");
  clearPromptCache();
}

async function callAnthropic(history, system) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    { model, max_tokens: 700, system, messages: history },
    { headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, timeout: 45000 }
  );
  return res.data.content.map((b) => b.text || "").join("").trim();
}

async function callOpenAI(history, system) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    { model, max_tokens: 700, messages: [{ role: "system", content: system }, ...history] },
    { headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, timeout: 45000 }
  );
  return res.data.choices[0].message.content.trim();
}

// ---- Vision: let the model actually look at the customer's photo ----
const VISION_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
export function visionMime(m) {
  const t = String(m || "").split(";")[0].trim().toLowerCase();
  return VISION_MIMES.has(t) ? t : "image/jpeg";
}

// Attach one or more images to the most recent user turn, in the provider's format.
function attachImages(history, images, provider) {
  const msgs = history.map((m) => ({ ...m }));
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== "user") continue;
    const text = typeof msgs[i].content === "string" ? msgs[i].content : "";
    const prompt = text || (images.length > 1 ? "O cliente enviou estas imagens. Analise-as e responda." : "O cliente enviou esta imagem. Analise-a e responda.");
    const blocks = images.map((img) =>
      provider === "openai"
        ? { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}` } }
        : { type: "image", source: { type: "base64", media_type: img.mime, data: img.base64 } });
    msgs[i] = provider === "openai"
      ? { role: "user", content: [{ type: "text", text: prompt }, ...blocks] }
      : { role: "user", content: [...blocks, { type: "text", text: prompt }] };
    break;
  }
  return msgs;
}

// ---- Whisper: transcribe a customer's voice note to text (OpenAI) ----
export async function transcribeAudio(base64, mime = "audio/ogg") {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.WHISPER_MODEL || "whisper-1";
  const ext = { "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/amr": "amr", "audio/wav": "wav" }[String(mime).split(";")[0].trim()] || "ogg";
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(base64, "base64")], { type: mime }), `audio.${ext}`);
  form.append("model", model);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.text || "").trim();
}

// history: [{role:'user'|'assistant', content}] (most recent last).
// opts.country selects the PT vs BR system prompt.
// opts.image = { base64, mime } attaches a photo for vision analysis.
// Make the history valid for the API: no empty blocks, alternating roles, and it
// must start AND end with a user turn (otherwise Anthropic rejects the request).
function normalizeHistory(history) {
  const out = [];
  for (const m of history || []) {
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = typeof m.content === "string" ? m.content.trim() : m.content;
    if (!content) continue; // empty content blocks are rejected
    const last = out[out.length - 1];
    if (last && last.role === role && typeof last.content === "string" && typeof content === "string") {
      last.content += "\n" + content; // merge consecutive same-role turns
    } else {
      out.push({ role, content });
    }
  }
  while (out.length && out[0].role !== "user") out.shift();
  while (out.length && out[out.length - 1].role !== "user") out.pop();
  return out.length ? out : [{ role: "user", content: "Olá" }];
}

export async function generateReply(history, opts = {}) {
  const system = opts.system || (await systemPrompt(opts.country));
  const images = (opts.images || (opts.image ? [opts.image] : [])).filter((i) => i?.base64);
  const base = normalizeHistory(history);
  const msgs = images.length ? attachImages(base, images, PROVIDER) : base;
  return PROVIDER === "openai" ? callOpenAI(msgs, system) : callAnthropic(msgs, system);
}
