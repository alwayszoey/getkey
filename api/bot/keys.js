const { connectDB } = require("../../_db");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Bot-Secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-bot-secret"];
  if (!secret || secret !== process.env.BOT_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const db = await connectDB();
    const keys = await db.collection("keys")
      .find({ discordId: String(userId), revoked: { $ne: true } })
      .toArray();

    const result = keys.map(k => ({
      key: k.key,
      expiresAt: k.expiresAt ? new Date(k.expiresAt).toLocaleDateString("en-US") : "Unknown",
      session: k.session || "HNPV",
      type: k.type || "1day"
    }));

    return res.status(200).json({ ok: true, keys: result });
  } catch (err) {
    console.error("[bot/keys]", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
};
