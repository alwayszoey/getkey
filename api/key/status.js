const { connectDB } = require("../_db");
const { checkRateLimit, getClientId, verify, applyRateLimitHeaders } = require("../_security");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientId = getClientId(req);
  const rate = checkRateLimit("status", clientId);
  applyRateLimitHeaders(res, rate);
  if (!rate.allowed) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const body = req.body || {};
  const session = typeof body.session === "string" ? body.session : "";

  const claim = verify(session);
  if (!claim || !claim.uid || claim.exp < Date.now()) {
    return res.status(401).json({ error: "Invalid session" });
  }

  try {
    const db = await connectDB();
    const keys = db.collection("keys");
    const now = Date.now();

    const latest = await keys.findOne(
      { discordId: claim.uid },
      { sort: { issuedAt: -1 } }
    );

    if (!latest) {
      return res.status(200).json({ locked: false });
    }

    const unlockAt = Math.max(latest.cooldownUntil || 0, latest.expireAt || 0);
    const locked = unlockAt > now;

    return res.status(200).json({
      locked,
      unlockAt: locked ? unlockAt : 0,
      type: latest.type,
      expiresAt: latest.expireAt
    });
  } catch (err) {
    console.error("[status]", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
};
