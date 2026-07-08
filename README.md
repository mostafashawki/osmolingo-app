# Osmolingo

Local-first AI language practice PWA built with React, Vite, Dexie, Radix UI, and a small local Node LLM proxy.

## Run

```bash
npm install
npm run dev
```

Open `https://localhost:5173/` on this machine or the network URL printed by Vite from another device on the same LAN. Vite uses a local development certificate; for PWA installation from another device, that device may need to trust the certificate.

## Build And Preview

```bash
npm run build
npm run preview
```

`npm run preview` serves the built PWA and API proxy from `server.cjs` on port `8787`.

## Docker Compose

Run the app as a long-lived local service on port `3007`:

```bash
docker compose up -d --build
```

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

The Compose service uses `restart: unless-stopped`, so Docker restarts it after crashes and host reboots unless you stop it. This also requires Docker itself to start on boot.

Open:

```text
http://localhost:3007/
```

## Environment

The browser app calls `/api/llm`; API keys are read only by the local Node process from `.env`.

Supported keys:

```bash
OPENAI_API_KEY=...
OPENROUTER_API_KEY=...
GEMINI_API_KEY=...
```

Gemini is supported in the provider settings, but it needs `GEMINI_API_KEY` in `.env`.

## Notifications

Notifications are scheduled while the app is open or running as an installed PWA. Fully closed-app background delivery would require a push service or a native/background process.

The app will not generate a new question while an existing question is still unanswered. Manual generation returns you to the pending question, and scheduled notifications become reminders for that same pending question, so API calls are not spent on extra questions before the current one is corrected.

Mixed question generation follows the configured prompt weights with a history-aware balance. With the default 65% business / 35% everyday mix, the sequence is actively nudged toward that ratio instead of relying on pure random choice.

When a notification question or reminder is sent, the app also tries to play `public/notification-tone.wav`. Browsers can still block sound until the user has interacted with the app or granted the relevant permissions.
