import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collectorPath = path.join(projectRoot, "scripts", "fetch-sources.mjs");
const feedPath = path.join(projectRoot, "public", "data", "latest.json");
const port = Number.parseInt(process.env.INFOMAP_REFRESH_PORT ?? "8787", 10);
const host = "127.0.0.1";
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

let activeRefresh = null;

function corsHeaders(origin) {
  return origin && allowedOrigins.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "accept, content-type",
        vary: "Origin",
      }
    : {};
}

function sendJson(response, status, payload, origin) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...corsHeaders(origin),
  });
  response.end(JSON.stringify(payload));
}

function collectLatestFeed() {
  if (activeRefresh) return activeRefresh;

  activeRefresh = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [collectorPath], {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = output.trim().split("\n").slice(-8).join("\n");
      reject(new Error(detail || `Collector stopped (${signal || code})`));
    });
  })
    .then(async () => JSON.parse(await readFile(feedPath, "utf8")))
    .finally(() => {
      activeRefresh = null;
    });

  return activeRefresh;
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;

  if (origin && !allowedOrigins.has(origin)) {
    sendJson(response, 403, { error: "Origin is not allowed" }, origin);
    return;
  }

  if (request.method === "OPTIONS" && request.url === "/refresh") {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true, refreshing: Boolean(activeRefresh) }, origin);
    return;
  }

  if (request.method !== "POST" || request.url !== "/refresh") {
    sendJson(response, 404, { error: "Not found" }, origin);
    return;
  }

  try {
    const feed = await collectLatestFeed();
    sendJson(response, 200, feed, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    console.error(`[refresh] ${message}`);
    sendJson(response, 500, { error: message }, origin);
  }
});

server.listen(port, host, () => {
  console.log(`Infomap refresh service ready at http://${host}:${port}`);
});

function shutDown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
