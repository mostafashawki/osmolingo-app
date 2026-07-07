const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const server = spawn(process.execPath, ["server.cjs", "--api-only"], {
  cwd: root,
  stdio: "inherit"
});

const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const vite = spawn(process.execPath, [viteBin, "--host", "0.0.0.0"], {
  cwd: root,
  stdio: "inherit"
});

function shutdown(signal) {
  server.kill(signal);
  vite.kill(signal);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.on("exit", (code) => {
  if (code) process.exit(code);
});

vite.on("exit", (code) => {
  server.kill("SIGTERM");
  process.exit(code || 0);
});
