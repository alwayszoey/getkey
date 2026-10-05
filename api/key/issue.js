const { connectDB } = require("../_db");

function generateKey(type) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const seg = (n) => {
    let s = "";
    for (let i = 0; i < n; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  };
  return `XH-${type.toUpperCase()}-${seg(4)}-${seg(4)}-${seg(4)}`;
}

const DURATION = {
  "1day": 1,
  "7day": 7,
  "30day": 30
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { discordId, type, hwid } = req.body || {};

  if (!discordId || !type || !hwid) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!DURATION[type]) {
    return res.status(400).json({ error: "Invalid type" });
  }

  try {
    const db = await connectDB();
    const keys = db.collection("keys");
    const users = db.collection("users");

    const user = await users.findOne({ discordId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = Date.now();
    const cooldownMs = 24 * 60 * 60 * 1000;

    const existing = await keys.findOne({
      discordId,
      $or: [
        { cooldownUntil: { $gt: now } },
        { expireAt: { $gt: now } }
      ]
    });

    if (existing) {
      const unlockAt = Math.max(existing.cooldownUntil || 0, existing.expireAt || 0);
      return res.status(429).json({
        error: "Cooldown active",
        unlockAt
      });
    }

    const key = generateKey(type);
    const expireAt = now + DURATION[type] * 24 * 60 * 60 * 1000;
    const cooldownUntil = now + cooldownMs;

    const doc = {
      key,
      type,
      discordId,
      username: user.username,
      hwid,
      issuedAt: now,
      expireAt,
      cooldownUntil,
      used: false
    };

    await keys.insertOne(doc);
    await users.updateOne(
      { discordId },
      {
        $set: { lastHwid: hwid, lastKeyAt: now },
        $inc: { totalKeys: 1 }
      }
    );

    return res.status(200).json({
      key,
      type,
      hwid,
      issuedAt: now,
      expireAt,
      cooldownUntil
    });
  } catch (err) {
    console.error("[issue] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
