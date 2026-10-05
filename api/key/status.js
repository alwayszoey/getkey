const { connectDB } = require("../_db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { discordId } = req.query;
  if (!discordId) {
    return res.status(400).json({ error: "Missing discordId" });
  }

  try {
    const db = await connectDB();
    const keys = db.collection("keys");
    const now = Date.now();

    const latest = await keys.findOne(
      { discordId },
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
      key: locked ? latest.key : null,
      type: locked ? latest.type : null
    });
  } catch (err) {
    console.error("[status] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
