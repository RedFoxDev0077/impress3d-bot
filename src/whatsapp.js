// WhatsApp Cloud API (Meta Graph API) send helpers.
import axios from "axios";

const VERSION = process.env.GRAPH_API_VERSION || "v21.0";

export async function sendText(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.warn("[whatsapp] WHATSAPP_TOKEN / PHONE_NUMBER_ID not set — skipping send");
    return { skipped: true };
  }
  const url = `https://graph.facebook.com/${VERSION}/${phoneId}/messages`;
  const res = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: body.slice(0, 4096) },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      timeout: 20000,
    }
  );
  return res.data;
}

// Mark a message as read (nice UX — shows blue ticks while the AI thinks).
export async function markRead(messageId) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
  const url = `https://graph.facebook.com/${VERSION}/${phoneId}/messages`;
  try {
    await axios.post(
      url,
      { messaging_product: "whatsapp", status: "read", message_id: messageId },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );
  } catch (e) {
    console.warn("[whatsapp] markRead failed:", e.response?.data || e.message);
  }
}
