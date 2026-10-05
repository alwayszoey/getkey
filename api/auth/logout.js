const { connectDB } = require("../_db");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  var body = req.body || {};
  var discordId = body.discordId;

  if (!discordId) {
    return res.status(400).json({ error: "Missing discordId" });
  }

  try {
    var db = await connectDB();
    var logouts = db.collection("logout_logs");
    var users = db.collection("users");

    var ip = ((req.headers["x-forwarded-for"] || "").split(",")[0] || "").trim() || "unknown";
    var ua = req.headers["user-agent"] || "unknown";

    await logouts.insertOne({
      discordId: discordId,
      ip: ip,
      userAgent: ua,
      loggedOutAt: new Date(),
      timestamp: Date.now()
    });

    await users.updateOne(
      { discordId: discordId },
      { $set: { lastLogoutAt: new Date() } }
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[logout]", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
