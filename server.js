import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { getHistory, appendMessage, setMeta } from "./src/store.js";
import { generateReply } from "./src/ai.js";
import { sendText, markRead } from "./src/whatsapp.js";

const app = express();
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const APP_SECRET = process.env.APP_SECRET || "";
const HANDOFF_KEYWORD = (process.env.HUMAN_HANDOFF_KEYWORD || "atendente").toLowerCase();

// Capture the raw body so we can verify Meta's X-Hub-Signature-256.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// --- Health check ---
app.get("/", (_req, res) => res.status(200).send("impress3d-bot OK"));
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// --- Meta webhook verification (GET) ---
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[webhook] verified by Meta");
    return res.status(200).send(challenge);
  }
  console.warn("[webhook] verification failed");
  return res.sendStatus(403);
});

// --- Signature check for incoming events ---
function validSignature(req) {
  if (!APP_SECRET) {
    console.warn("[webhook] APP_SECRET not set — skipping signature check (set it before go-live)");
    return true;
  }
  const sig = req.get("x-hub-signature-256");
  if (!sig || !req.rawBody) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(req.rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// --- Incoming messages (POST) ---
app.post("/webhook", async (req, res) => {
  if (!validSignature(req)) {
    console.warn("[webhook] bad signature");
    return res.sendStatus(401);
  }
  // Always ack fast so Meta doesn't retry; process async.
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    if (!msg) return; // status callbacks etc.

    const from = msg.from; // customer phone number (wa_id)
    const profileName = change?.contacts?.[0]?.profile?.name || "";
    if (msg.type !== "text") {
      await sendText(
        from,
        "De momento consigo responder a mensagens de texto. Pode escrever a sua questão? 🙂"
      );
      return;
    }

    const text = msg.text.body.trim();
    console.log(`[msg] ${from} (${profileName}): ${text}`);
    if (msg.id) markRead(msg.id);

    // Human handoff on keyword
    if (text.toLowerCase().includes(HANDOFF_KEYWORD)) {
      await setMeta(from, { handoff: true, handoffAt: new Date().toISOString() });
      await appendMessage(from, "user", text);
      await sendText(
        from,
        "Sem problema — vou encaminhar para um colega da equipa. Aguarde só um momento. 👍"
      );
      return;
    }

    await appendMessage(from, "user", text);
    const history = await getHistory(from);

    let reply;
    try {
      reply = await generateReply(history);
    } catch (e) {
      console.error("[ai] error:", e.response?.data || e.message);
      reply =
        "Peço desculpa, tive um problema técnico a processar a sua mensagem. Pode repetir, por favor?";
    }

    await appendMessage(from, "assistant", reply);
    await sendText(from, reply);
  } catch (e) {
    console.error("[webhook] handler error:", e);
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`impress3d-bot listening on 127.0.0.1:${PORT} (provider=${process.env.AI_PROVIDER || "anthropic"})`);
});
