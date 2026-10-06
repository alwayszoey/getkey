const { connectDB } = require("../../_db");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Bot-Secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-bot-secret"];
  if (!secret || secret !== process.env.BOT_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body || {};
  const userId = typeof body.userId === "string" ? body.userId : "";
  const key = typeof body.key === "string" ? body.key : "";

  if (!userId || !key) {
    return res.status(400).json({ error: "Missing userId or key" });
  }

  try {
    const db = await connectDB();
    const users = db.collection("users");
    const keys = db.collection("keys");

    const existing = await keys.findOne({
      discordId: userId,
      key: key,
      revoked: { $ne: true }
    });

    if (!existing) {
      return res.status(404).json({ error: "Key not found or already revoked" });
    }

    const now = Date.now();

    await keys.updateOne(
      { _id: existing._id },
      {
        $set: {
          revoked: true,
          revokedAt: now,
          revokedReason: "bot_hwid_reset"
        }
      }
    );

    await users.updateOne(
      { discordId: userId },
      {
        $set: {
          lastHwidHash: null,
          hwidResetAt: now
        }
      }
    );

    return res.status(200).json({
      ok: true,
      message: "HWID reset successfully. You can now claim a new key at getkeyxcl.vercel.app"
    });
  } catch (err) {
    console.error("[bot/reset]", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
};
