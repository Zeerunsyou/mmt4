
const express = require("express");
const crypto = require("node:crypto");

const app = express();
app.use(express.json({ limit: "10kb" }));

let settings = {
  walkSpeed: 16,
  jumpPower: 50,
  updatedAt: new Date().toISOString()
};

let report = null;

function tokenMatches(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") {
    return false;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireToken(environmentVariable) {
  return (req, res, next) => {
    const expected = process.env[environmentVariable];

    if (!expected) {
      return res.status(500).json({
        error: `${environmentVariable} is not configured in Vercel.`
      });
    }

    const authorization = req.get("authorization") || "";
    const provided = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!tokenMatches(provided, expected)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  };
}

const dashboardAuth = requireToken("DASHBOARD_TOKEN");
const robloxAuth = requireToken("ROBLOX_TOKEN");

app.get("/", (_req, res) => {
  res.redirect("/index.html");
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "mmt4-api" });
});

app.get("/api/settings", dashboardAuth, (_req, res) => {
  res.json({ settings });
});

app.put("/api/settings", dashboardAuth, (req, res) => {
  const { walkSpeed, jumpPower } = req.body || {};

  if (
    !Number.isFinite(walkSpeed) ||
    walkSpeed < 8 ||
    walkSpeed > 32 ||
    !Number.isFinite(jumpPower) ||
    jumpPower < 25 ||
    jumpPower > 100
  ) {
    return res.status(400).json({
      error: "Walk speed must be 8–32 and jump power must be 25–100."
    });
  }

  settings = {
    walkSpeed,
    jumpPower,
    updatedAt: new Date().toISOString()
  };

  res.json({ settings });
});

app.get("/api/report", dashboardAuth, (_req, res) => {
  res.json({ report });
});

app.get("/api/roblox/settings", robloxAuth, (_req, res) => {
  res.json({ settings });
});

app.post("/api/roblox/report", robloxAuth, (req, res) => {
  const body = req.body || {};

  report = {
    receivedAt: new Date().toISOString(),
    serverJobId: String(body.serverJobId || "").slice(0, 100),
    playerCount:
      Number.isInteger(body.playerCount) && body.playerCount >= 0
        ? body.playerCount
        : 0,
    appliedSettings: body.appliedSettings || null
  };

  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error("Request error:", err.message);

  res.status(400).json({
    error: "Invalid request."
  });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

module.exports = app;
