const express = require("express");
app.use(express.static("public"));
const crypto = require("node:crypto");

const app = express();
app.use(express.json({ limit: "10kb" }));

const PORT = process.env.PORT || 3000;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN;
const ROBLOX_TOKEN = process.env.ROBLOX_TOKEN;

if (!DASHBOARD_TOKEN || !ROBLOX_TOKEN) {
  throw new Error("Set DASHBOARD_TOKEN and ROBLOX_TOKEN environment variables.");
}

let settings = { walkSpeed: 16, jumpPower: 50, updatedAt: new Date().toISOString() };
let report = null;

function tokenMatches(provided, expected) {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireToken(expected) {
  return (req, res, next) => {
    const header = req.get("authorization") || "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!tokenMatches(provided, expected)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };
}

// Dashboard: read or update experience settings.
app.get("/api/settings", requireToken(DASHBOARD_TOKEN), (_req, res) => {
  res.json({ settings });
});

app.put("/api/settings", requireToken(DASHBOARD_TOKEN), (req, res) => {
  const { walkSpeed, jumpPower } = req.body || {};
  if (!Number.isFinite(walkSpeed) || walkSpeed < 8 || walkSpeed > 32 ||
      !Number.isFinite(jumpPower) || jumpPower < 25 || jumpPower > 100) {
    return res.status(400).json({ error: "walkSpeed must be 8–32 and jumpPower 25–100." });
  }

  settings = { walkSpeed, jumpPower, updatedAt: new Date().toISOString() };
  res.json({ settings });
});

app.get("/api/report", requireToken(DASHBOARD_TOKEN), (_req, res) => {
  res.json({ report });
});

// Roblox server: retrieve settings and send back a status report.
app.get("/api/roblox/settings", requireToken(ROBLOX_TOKEN), (_req, res) => {
  res.json({ settings });
});

app.post("/api/roblox/report", requireToken(ROBLOX_TOKEN), (req, res) => {
  report = {
    receivedAt: new Date().toISOString(),
    serverJobId: String(req.body?.serverJobId || "").slice(0, 100),
    playerCount: Number.isInteger(req.body?.playerCount) ? req.body.playerCount : 0,
    appliedSettings: req.body?.appliedSettings || null
  };
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
}

module.exports = app;
