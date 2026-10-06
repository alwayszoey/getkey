const { connectDB } = require("../_db");
const { getClientIp } = require("../_security");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const discordId = typeof body.discordId === "string" ? body.discordId : "";

  if (!discordId) {
    return res.status(400).json({ error: "Missing discordId" });
  }

  try {
    const db = await connectDB();
    const logouts = db.collection("logout_logs");
    const users = db.collection("users");

    const ip = getClientIp(req);
    const ua = req.headers["user-agent"] || "unknown";

    await logouts.insertOne({
      discordId,
      ip,
      userAgent: ua,
      loggedOutAt: new Date(),
      timestamp: Date.now()
    });

    await users.updateOne(
      { discordId },
      { $set: { lastLogoutAt: new Date() } }
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[logout]", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
};
