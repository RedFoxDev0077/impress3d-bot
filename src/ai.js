// AI provider abstraction. Supports Anthropic (Claude) and OpenAI.
// Switch with AI_PROVIDER=anthropic|openai in .env.
import axios from "axios";
import { promises as fs } from "node:fs";
import path from "node:path";

const PROVIDER = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
let systemPromptCache = null;

async function systemPrompt() {
  if (systemPromptCache) return systemPromptCache;
  const p = path.resolve(process.cwd(), "prompts", "system.md");
  systemPromptCache = await fs.readFile(p, "utf-8");
  return systemPromptCache;
}

async function callAnthropic(history) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model,
      max_tokens: 700,
      system: await systemPrompt(),
      messages: history, // [{role:'user'|'assistant', content:'...'}]
    },
    {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      timeout: 45000,
    }
  );
  return res.data.content.map((b) => b.text || "").join("").trim();
}

async function callOpenAI(history) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      max_tokens: 700,
      messages: [{ role: "system", content: await systemPrompt() }, ...history],
    },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      timeout: 45000,
    }
  );
  return res.data.choices[0].message.content.trim();
}

// history: [{role:'user'|'assistant', content:'...'}] most recent last
export async function generateReply(history) {
  if (PROVIDER === "openai") return callOpenAI(history);
  return callAnthropic(history);
}
