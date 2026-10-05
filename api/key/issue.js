const { connectDB } = require("../_db");
const {
  checkRateLimit,
  getClientId,
  getClientIp,
  verify,
  generateKey,
  hashKey,
  hashHwid,
  applyRateLimitHeaders
} = require("../_security");

const DURATION_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
  const rate = checkRateLimit("issue", clientId);
  applyRateLimitHeaders(res, rate);
  if (!rate.allowed) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const body = req.body || {};
  const session = typeof body.session === "string" ? body.session : "";
  const hwid = typeof body.hwid === "string" ? body.hwid : "";
  const type = typeof body.type === "string" ? body.type : "";

  if (type !== "1day") {
    return res.status(400).json({ error: "Invalid key type" });
  }

  if (!hwid || hwid.length < 8 || hwid.length > 256) {
    return res.status(400).json({ error: "Invalid hardware id" });
  }

  const claim = verify(session);
  if (!claim || !claim.uid || claim.exp < Date.now()) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  try {
    const db = await connectDB();
    const users = db.collection("users");
    const keys = db.collection("keys");
    const logs = db.collection("key_logs");

    const user = await users.findOne({ discordId: claim.uid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = Date.now();
    const hwidHash = hashHwid(hwid);
    const ip = getClientIp(req);

    const locked = await keys.findOne({
      discordId: claim.uid,
      $or: [
        { cooldownUntil: { $gt: now } },
        { expireAt: { $gt: now } }
      ]
    });

    if (locked) {
      const unlockAt = Math.max(locked.cooldownUntil || 0, locked.expireAt || 0);

      await logs.insertOne({
        discordId: claim.uid,
        username: user.username,
        type,
        hwidHash,
        ip,
        action: "denied",
        reason: "cooldown_active",
        unlockAt,
        at: new Date()
      });

      return res.status(429).json({
        error: "Cooldown active",
        unlockAt
      });
    }

    const plain = generateKey(type);
    const keyHash = hashKey(plain);
    const expireAt = now + DURATION_MS;
    const cooldownUntil = now + COOLDOWN_MS;

    await keys.insertOne({
      keyHash,
      type,
      discordId: claim.uid,
      username: user.username,
      hwidHash,
      issuedAt: now,
      expireAt,
      cooldownUntil,
      issuedIp: ip,
      revoked: false,
      used: false
    });

    await users.updateOne(
      { discordId: claim.uid },
      {
        $set: { lastHwidHash: hwidHash, lastKeyAt: now },
        $inc: { totalKeys: 1 }
      }
    );

    await logs.insertOne({
      discordId: claim.uid,
      username: user.username,
      type,
      hwidHash,
      ip,
      action: "issued",
      expireAt,
      at: new Date()
    });

    return res.status(200).json({
      key: plain,
      type,
      issuedAt: now,
      expireAt,
      cooldownUntil
    });
  } catch (err) {
    console.error("[issue]", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
};
