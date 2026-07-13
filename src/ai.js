// AI provider abstraction. Supports Anthropic (Claude) and OpenAI.
// Switch with AI_PROVIDER=anthropic|openai in .env.
import axios from "axios";
import { promises as fs } from "node:fs";
import path from "node:path";

const PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
const promptCache = new Map();

// Load the country-specific system prompt (falls back to the generic one).
export async function systemPrompt(country = "") {
  const cc = String(country).toLowerCase();
  const candidates = [cc && `system.${cc}.md`, "system.md"].filter(Boolean);
  for (const file of candidates) {
    if (promptCache.has(file)) return promptCache.get(file);
    try {
      const txt = await fs.readFile(path.resolve(process.cwd(), "prompts", file), "utf-8");
      promptCache.set(file, txt);
      return txt;
    } catch {}
  }
  return "You are a helpful WhatsApp assistant for a 3D printing company. Reply in the customer's language.";
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
