const { connectDB } = require("../_db");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const discordId = req.query.discordId;
  const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);

  if (!discordId) {
    return res.status(400).json({ error: "Missing discordId" });
  }

  try {
    const db = await connectDB();
    const logins = db.collection("login_logs");

    const list = await logins
      .find({ discordId })
      .sort({ at: -1 })
      .limit(limit)
      .toArray();

    const items = list.map(function (x) {
      return {
        id: x._id.toString(),
        ip: x.ip,
        userAgent: x.userAgent,
        country: x.country,
        city: x.city,
        isNewUser: x.isNewUser,
        loggedInAt: x.at
      };
    });

    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    console.error("[history]", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
};
