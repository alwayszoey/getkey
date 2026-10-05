const { connectDB } = require("../_db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  var discordId = req.query.discordId;
  var limit = Math.min(parseInt(req.query.limit || "20", 10), 50);

  if (!discordId) {
    return res.status(400).json({ error: "Missing discordId" });
  }

  try {
    var db = await connectDB();
    var logins = db.collection("login_logs");

    var list = await logins
      .find({ discordId: discordId })
      .sort({ loggedInAt: -1 })
      .limit(limit)
      .toArray();

    var items = list.map(function (x) {
      return {
        id: x._id.toString(),
        ip: x.ip,
        userAgent: x.userAgent,
        country: x.country,
        city: x.city,
        isNewUser: x.isNewUser,
        loggedInAt: x.loggedInAt
      };
    });

    return res.status(200).json({ items: items, total: items.length });
  } catch (err) {
    console.error("[history]", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
