const { connectDB } = require("../_db");
const { generateKey, hashKey } = require("../_security");

const DAY_MS = 24 * 60 * 60 * 1000;

const DURATIONS = {
  "1day": 1 * DAY_MS,
  "3day": 3 * DAY_MS,
  "7day": 7 * DAY_MS,
  "lifetime": 100 * 365 * DAY_MS
};

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Bot-Secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = req.headers["x-bot-secret"];
  if (!secret || secret !== process.env.BOT_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body || {};
  const userId = typeof body.userId === "string" ? body.userId : "";
  const type = typeof body.type === "string" ? body.type : "1day";
  const amount = Math.min(Math.max(parseInt(body.amount) || 1, 1), 25);

  if (!userId) return res.status(400).json({ error: "Missing userId" });

  if (!DURATIONS[type]) {
    return res.status(400).json({ error: "Invalid key type. Use: 1day, 3day, 7day, lifetime" });
  }

  try {
    const db = await connectDB();
    const keys = db.collection("keys");
    const users = db.collection("users");

    const user = await users.findOne({ discordId: String(userId) });
    const now = Date.now();
    const duration = DURATIONS[type];
    const expireAt = now + duration;
    const cooldownUntil = now + duration;

    const generatedKeys = [];

    for (let i = 0; i < amount; i++) {
      const plain = generateKey(type);
      const keyHash = hashKey(plain);

      await keys.insertOne({
        key: plain,
        keyHash: keyHash,
        type: type,
        discordId: String(userId),
        username: user ? user.username : "admin-generated",
        hwidHash: null,
        issuedAt: now,
        expireAt: expireAt,
        cooldownUntil: cooldownUntil,
        issuedIp: "admin-bot",
        issuedFromHwid: "admin-bot",
        gateStep1At: null,
        gateStep2At: null,
        lvStep2ReturnAt: null,
        revoked: false,
        used: false,
        boundAt: null,
        adminGenerated: true
      });

      generatedKeys.push(plain);
    }

    return res.status(200).json({
      ok: true,
      keys: generatedKeys,
      amount: amount,
      type: type,
      expireAt: expireAt,
      cooldownUntil: cooldownUntil
    });
  } catch (err) {
    console.error("[bot/generate]", err.message);
    return res.status(500).json({ error: "Internal error: " + err.message });
  }
};
