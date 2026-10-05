const { connectDB } = require("../_db");

function generateKey(type) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  function seg(n) {
    var s = "";
    for (var i = 0; i < n; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  }
  return "XH-" + type.toUpperCase() + "-" + seg(4) + "-" + seg(4) + "-" + seg(4);
}

var DURATION = {
  "1day": 1
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  var body = req.body || {};
  var discordId = body.discordId;
  var type = body.type;
  var hwid = body.hwid;

  if (!discordId || !type || !hwid) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!DURATION[type]) {
    return res.status(400).json({ error: "Invalid type" });
  }

  try {
    var db = await connectDB();
    var keys = db.collection("keys");
    var users = db.collection("users");
    var keyLogs = db.collection("key_logs");

    var user = await users.findOne({ discordId: discordId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    var now = Date.now();
    var cooldownMs = 24 * 60 * 60 * 1000;

    var existing = await keys.findOne({
      discordId: discordId,
      $or: [
        { cooldownUntil: { $gt: now } },
        { expireAt: { $gt: now } }
      ]
    });

    var ip = ((req.headers["x-forwarded-for"] || "").split(",")[0] || "").trim() || "unknown";
    var ua = req.headers["user-agent"] || "unknown";

    if (existing) {
      var unlockAt = Math.max(existing.cooldownUntil || 0, existing.expireAt || 0);

      await keyLogs.insertOne({
        discordId: discordId,
        username.username,
        type: type,
        hwid: hwid,
        ip: ip,
        userAgent: ua,
        action: "denied",
        reason: "cooldown_active",
        unlockAt: unlockAt,
        at: new Date()
      });

      return res.status(429).json({
        error: "Cooldown active",
        unlockAt: unlockAt
      });
    }

    var key = generateKey(type);
    var expireAt = now + DURATION[type] * 24 * 60 * 60 * 1000;
    var cooldownUntil = now + cooldownMs;

    var doc = {
      key: key,
      type: type,
      discordId: discordId,
      username: user.username,
      hwid: hwid,
      issuedAt: now,
      expireAt: expireAt,
      cooldownUntil: cooldownUntil,
      issuedIp: ip,
      issuedUserAgent: ua,
      used: false
    };

    await keys.insertOne(doc);

    await users.updateOne(
      { discordId: discordId },
      {
        $set: { lastHwid: hwid, lastKeyAt: now },
        $inc: { totalKeys: 1 }
      }
    );

    await keyLogs.insertOne({
      discordId: discordId,
      username: user.username,
      key: key,
      type: type,
      hwid: hwid,
      ip: ip,
      userAgent: ua,
      action: "issued",
      expireAt: expireAt,
      at: new Date()
    });

    return res.status(200).json({
      key: key,
      type: type,
      hwid: hwid,
      issuedAt: now,
      expireAt: expireAt,
      cooldownUntil: cooldownUntil
    });
  } catch (err) {
    console.error("[issue]", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
