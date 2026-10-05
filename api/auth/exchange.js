const { connectDB } = require("../_db");

const TOKEN_URL = "https://discord.com/api/v10/oauth2/token";
const USER_URL = "https://discord.com/api/v10/users/@me";
const COLORS = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245"];

function getClientInfo(req) {
  var h = req.headers || {};
  return {
    ip: (h["x-forwarded-for"] || "").split(",")[0].trim() || h["x-real-ip"] || "unknown",
    userAgent: h["user-agent"] || "unknown",
    referer: h["referer"] || null,
    origin: h["origin"] || null,
    country: h["x-vercel-ip-country"] || null,
    city: h["x-vercel-ip-city"] || null,
    region: h["x-vercel-ip-country-region"] || null
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  var body = req.body || {};
  var code = body.code;
  var redirectUri = body.redirect_uri;

  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  var clientId = process.env.DISCORD_CLIENT_ID;
  var clientSecret = process.env.DISCORD_CLIENT_SECRET;
  var fallbackRedirect = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Discord credentials missing" });
  }

  try {
    var tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri || fallbackRedirect
      })
    });

    var tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(400).json({
        error: "Token exchange failed",
        detail: tokenData
      });
    }

    var userRes = await fetch(USER_URL, {
      headers: { Authorization: "Bearer " + tokenData.access_token }
    });

    var discordUser = await userRes.json();

    if (!userRes.ok || !discordUser.id) {
      return res.status(400).json({
        error: "Failed to fetch Discord user",
        detail: discordUser
      });
    }

    var color = COLORS[parseInt(discordUser.id.slice(-1), 10) % COLORS.length];
    var now = new Date();
    var client = getClientInfo(req);

    var db = await connectDB();
    var users = db.collection("users");
    var logins = db.collection("login_logs");

    var isNew = false;
    var existing = await users.findOne({ discordId: discordUser.id });
    if (!existing) isNew = true;

    await users.updateOne(
  { discordId: discordUser.id },
  {
    $set: {
      discordId: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name || null,
      discriminator: discordUser.discriminator || "0",
      avatar: discordUser.avatar || null,
      avatarColor: color,
      lastLoginAt: now,
      lastIp: ip,
      lastUserAgent: ua
    },
    $setOnInsert: {
      createdAt: now
    },
    $inc: { totalLogins: 1 }
  },
  { upsert: true }
);

    await logins.insertOne({
      discordId: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator || "0",
      avatar: discordUser.avatar || null,
      avatarColor: color,
      ip: client.ip,
      userAgent: client.userAgent,
      referer: client.referer,
      origin: client.origin,
      country: client.country,
      city: client.city,
      region: client.region,
      isNewUser: isNew,
      provider: "discord",
      loggedInAt: now,
      timestamp: now.getTime()
    });

    var saved = await users.findOne({ discordId: discordUser.id });

    return res.status(200).json({
      user: {
        id: saved.discordId,
        username: saved.username,
        discriminator: saved.discriminator,
        global_name: saved.globalName,
        avatar: saved.avatar,
        avatarColor: saved.avatarColor
      },
      isNewUser: isNew,
      totalLogins: saved.totalLogins || 1
    });
  } catch (err) {
    console.error("[exchange]", err);

    try {
      var db2 = await connectDB();
      await db2.collection("login_errors").insertOne({
        error: err.message,
        stack: err.stack ? err.stack.split("\n").slice(0, 5) : null,
        client: getClientInfo(req),
        occurredAt: new Date()
      });
    } catch (e) {}

    return res.status(500).json({ error: "Internal error" });
  }
};
