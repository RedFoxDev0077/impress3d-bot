# impress3d-bot

WhatsApp Cloud API assistant for **Impress3D** (3D printing — Portugal & Brasil).
ManyChat/Meta handle message I/O; this service owns the conversation logic:
per-contact context, AI replies (Claude or OpenAI), and structured hand-off for
custom quotes.

## Architecture

```
WhatsApp Cloud API ──webhook──▶ Nginx (TLS) ──▶ Node service (127.0.0.1:3000)
                                                   ├── conversation store (per phone)
                                                   ├── AI provider (Anthropic | OpenAI)
                                                   └── Graph API reply
```

## Stack
- Node.js 22 + Express
- Nginx reverse proxy + Let's Encrypt TLS
- systemd service (`impress3d-bot`)

## Endpoints
| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET  | `/health`  | health probe |
| GET  | `/webhook` | Meta webhook verification |
| POST | `/webhook` | inbound messages (HMAC-verified) |

## Configuration
Copy `.env.example` to `.env` and fill in the values:

| Var | Description |
| --- | ----------- |
| `VERIFY_TOKEN` | matches the token set in Meta webhook config |
| `WHATSAPP_TOKEN` | Meta permanent access token |
| `PHONE_NUMBER_ID` | Meta phone number id |
| `APP_SECRET` | Meta app secret (enables signature verification) |
| `AI_PROVIDER` | `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | model provider key |
| `HISTORY_TURNS` | number of past turns sent to the model |
| `HUMAN_HANDOFF_KEYWORD` | keyword that routes to a human |

The system prompt (company services, prices, FAQ) lives in `prompts/system.md`.

## Run locally
```bash
npm install
npm start
```

## Deployment
Runs as a systemd unit on the VPS. Pushing to `main` triggers the GitHub Actions
workflow in `.github/workflows/deploy.yml`, which pulls the latest code and
restarts the service. See that file for details.

```bash
sudo systemctl status impress3d-bot
journalctl -u impress3d-bot -f
```
