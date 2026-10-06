const { connectDB } = require("../_db");
const {
  checkRateLimit,
  getClientId,
  getClientIp,
  sign,
  verify,
  applyRateLimitHeaders,
  isBanned
} = require("../_security");

const BAN_DURATION_MS = 60 * 60 * 1000;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
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

  const db = await connectDB();
  const ip = getClientIp(req);

  if (await isBanned(db, ip)) {
    const rec = await db.collection("ip_bans").findOne({ ip: ip });
    return res.status(403).json({
      error: "Banned",
      reason: rec ? rec.reason : "policy_violation",
      banned: true,
      expiresAt: rec ? rec.expiresAt : (Date.now() + BAN_DURATION_MS)
    });
  }

  const body = req.body || {};
  const session = typeof body.session === "string" ? body.session : "";

  const claim = verify(session);
  if (!claim || !claim.uid || claim.exp < Date.now()) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const now = Date.now();

  const activeKey = await db.collection("keys").findOne({
    discordId: claim.uid,
    revoked: { $ne: true },
    $or: [
      { cooldownUntil: { $gt: now } },
      { expireAt: { $gt: now } }
    ]
  });

  if (activeKey) {
    const unlockAt = Math.max(activeKey.cooldownUntil || 0, activeKey.expireAt || 0);
    return res.status(200).json({
      locked: true,
      unlockAt: unlockAt,
      expireAt: activeKey.expireAt || null,
      cooldownUntil: activeKey.cooldownUntil || null,
      type: activeKey.type || "1day"
    });
  }

  const hwid = typeof body.hwid === "string" ? body.hwid : "";
  const type = typeof body.type === "string" ? body.type : "";

  if (type !== "1day") {
    return res.status(200).json({ locked: false });
  }

  if (!hwid || hwid.length < 8 || hwid.length > 256) {
    return res.status(200).json({ locked: false });
  }

  const users = db.collection("users");
  const user = await users.findOne({ discordId: claim.uid });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const gate = db.collection("gate_tokens");

  await gate.updateOne(
    { discordId: claim.uid },
    {
      $set: {
        discordId: claim.uid,
        hwid: hwid,
        type: type,
        step1At: now,
        step1Ip: ip,
        step2At: null,
        step2Ip: null,
        consumed: false
      }
    },
    { upsert: true }
  );

  const step1Token = sign({
    uid: claim.uid,
    step: 1,
    iat: now,
    exp: now + 1000 * 60 * 10
  });

  return res.status(200).json({
    locked: false,
    step1Token: step1Token,
    linkvertiseStep1: process.env.LINKVERTISE_STEP1_URL || null,
    linkvertiseStep2: process.env.LINKVERTISE_STEP2_URL || null
  });
};
