const { connectDB } = require("../_db");
const { checkRateLimit, getClientId, getClientIp, sign, applyRateLimitHeaders } = require("../_security");

const TOKEN_URL = "https://discord.com/api/v10/oauth2/token";
const USER_URL = "https://discord.com/api/v10/users/@me";
const COLORS = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245"];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientId = getClientId(req);
  const rate = checkRateLimit("exchange", clientId);
  applyRateLimitHeaders(res, rate);
  if (!rate.allowed) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const body = req.body || {};
  const code = typeof body.code === "string" ? body.code : "";
  const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri : "";

  if (!code || code.length > 512) {
    return res.status(400).json({ error: "Invalid code" });
  }

  const dcid = process.env.DISCORD_CLIENT_ID;
  const dcsecret = process.env.DISCORD_CLIENT_SECRET;
  const fallback = process.env.DISCORD_REDIRECT_URI;

  if (!dcid || !dcsecret) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: dcid,
        client_secret: dcsecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri || fallback
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(400).json({ error: "Authentication failed" });
    }

    const userRes = await fetch(USER_URL, {
      headers: { Authorization: "Bearer " + tokenData.access_token }
    });

    const discordUser = await userRes.json();

    if (!userRes.ok || !discordUser.id) {
      return res.status(400).json({ error: "Authentication failed" });
    }

    const color = COLORS[parseInt(discordUser.id.slice(-1), 10) % COLORS.length];
    const now = new Date();
    const ip = getClientIp(req);
    const ua = req.headers["user-agent"] || "unknown";

    const db = await connectDB();
    const users = db.collection("users");
    const logs = db.collection("login_logs");

    const existing = await users.findOne({ discordId: discordUser.id });
    const isNew = !existing;

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
          createdAt: now,
          totalKeys: 0
        },
        $inc: { totalLogins: 1 }
      },
      { upsert: true }
    );

    await logs.insertOne({
      discordId: discordUser.id,
      username: discordUser.username,
      ip,
      userAgent: ua,
      country: req.headers["x-vercel-ip-country"] || null,
      city: req.headers["x-vercel-ip-city"] || null,
      isNewUser: isNew,
      at: now
    });

    const sessionPayload = {
      uid: discordUser.id,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7
    };

    const session = sign(sessionPayload);

    return res.status(200).json({
      session,
      user: {
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator || "0",
        global_name: discordUser.global_name || null,
        avatar: discordUser.avatar || null,
        avatarColor: color
      }
    });
  } catch (err) {
    console.error("[exchange]", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
};
