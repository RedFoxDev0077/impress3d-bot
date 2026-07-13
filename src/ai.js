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

// history: [{role:'user'|'assistant', content}] (most recent last).
// opts.country selects the PT vs BR system prompt.
export async function generateReply(history, opts = {}) {
  const system = opts.system || (await systemPrompt(opts.country));
  return PROVIDER === "openai" ? callOpenAI(history, system) : callAnthropic(history, system);
}
