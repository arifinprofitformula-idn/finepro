import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET;

if (!SECRET) {
  console.error("❌ GITHUB_WEBHOOK_SECRET tidak disetel di .env");
  process.exit(1);
}

function verifySignature(payload, signature) {
  const hmac = crypto.createHmac("sha256", SECRET);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function runDeploy() {
  const ts = new Date().toISOString();
  console.log(`[${ts}] 🚀 Deploy triggered`);

  const child = spawn("bash", ["/home/ubuntu/deploy-finepro.sh"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  console.log(`[${ts}] Deploy script pid=${child.pid}`);
}

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("finepro-webhook OK\n");
    return;
  }

  // Only accept POST from GitHub
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method Not Allowed\n");
    return;
  }

  const sig = req.headers["x-hub-signature-256"];
  if (!sig) {
    res.writeHead(401);
    res.end("Missing signature\n");
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (!verifySignature(body, sig)) {
      res.writeHead(401);
      res.end("Invalid signature\n");
      return;
    }

    let event = "unknown";
    try {
      const payload = JSON.parse(body);
      event = req.headers["x-github-event"] || "unknown";
      const ref = payload?.ref || "";

      if (event === "push" && ref === "refs/heads/main") {
        console.log(`[${new Date().toISOString()}] ✅ Push to main — triggering deploy`);
        runDeploy();
      } else if (event === "ping") {
        console.log(`[${new Date().toISOString()}] 🔔 Ping received`);
      } else {
        console.log(`[${new Date().toISOString()}] ℹ️  Event: ${event}, ref: ${ref} — skipped`);
      }
    } catch {
      // ignore parse errors
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", event }));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`🔌 Webhook listener running on http://127.0.0.1:${PORT}`);
  console.log(`   Secret: ${SECRET.slice(0, 8)}...`);
});
