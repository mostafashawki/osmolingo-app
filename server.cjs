const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const root = __dirname;
const distDir = path.join(root, "dist");
const port = Number(process.env.PORT || 8787);
const apiOnly = process.argv.includes("--api-only");

loadEnv(path.join(root, ".env"));

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        keys: {
          openai: Boolean(process.env.OPENAI_API_KEY),
          openrouter: Boolean(process.env.OPENROUTER_API_KEY),
          gemini: Boolean(process.env.GEMINI_API_KEY)
        }
      });
    }

    if (url.pathname === "/api/llm" && req.method === "POST") {
      const body = await readJson(req);
      const text = await callProvider(body);
      return sendJson(res, 200, { text });
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson(res, 404, { error: "Unknown API route." });
    }

    if (apiOnly) {
      return sendJson(res, 404, { error: "Static serving is disabled in API-only mode." });
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`Osmolingo server listening on http://0.0.0.0:${port}\n`);
});

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

async function callProvider(body) {
  assertString(body.provider, "provider");
  assertString(body.model, "model");
  assertString(body.system, "system");
  assertString(body.user, "user");

  if (body.provider === "openai") {
    return callOpenAi(body);
  }

  if (body.provider === "openrouter") {
    return callOpenRouter(body);
  }

  if (body.provider === "gemini") {
    return callGemini(body);
  }

  throw new Error(`Unsupported provider: ${body.provider}`);
}

async function callOpenAi({ model, system, user }) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: system,
      input: user
    })
  });

  const payload = await readProviderResponse(response);
  return payload.output_text || extractText(payload) || "";
}

async function callOpenRouter({ model, system, user }) {
  const apiKey = requiredEnv("OPENROUTER_API_KEY");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost",
      "X-Title": "Osmolingo"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })
  });

  const payload = await readProviderResponse(response);
  return payload.choices?.[0]?.message?.content || "";
}

async function callGemini({ model, system, user }) {
  const apiKey = requiredEnv("GEMINI_API_KEY");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: user }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    }
  );

  const payload = await readProviderResponse(response);
  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}

async function readProviderResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message =
      payload.error?.message ||
      payload.error ||
      `Provider request failed with status ${response.status}.`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
}

function extractText(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value)) return value.map(extractText).join("");
  return Object.values(value).map(extractText).join("");
}

function requiredEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured in .env.`);
  }
  return value;
}

function assertString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${name}.`);
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(requestPath, res) {
  const cleanPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(distDir, cleanPath));
  if (!filePath.startsWith(distDir)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }

  const target = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(distDir, "index.html");

  if (!fs.existsSync(target)) {
    sendJson(res, 404, { error: "Build output not found. Run npm run build first." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentType(target),
    "Cache-Control": target.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable"
  });
  fs.createReadStream(target).pipe(res);
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json"
  }[ext] || "application/octet-stream";
}
