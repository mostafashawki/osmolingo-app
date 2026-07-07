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
