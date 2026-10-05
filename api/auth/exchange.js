const { connectDB } = require("../_db");

const DISCORD_TOKEN_URL = "https://discord.com/api/v10/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/v10/users/@me";

const AVATAR_COLORS = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245"];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const code = body.code;
  const redirectUri = body.redirect_uri;

  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const fallbackRedirect = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Discord credentials missing" });
  }

  try {
    const tokenRes = await fetch(DISCORD_TOKEN_URL, {
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

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(400).json({
        error: "Token exchange failed",
        detail: tokenData
      });
    }

    const userRes = await fetch(DISCORD_USER_URL, {
      headers: { Authorization: "Bearer " + tokenData.access_token }
    });

    const discordUser = await userRes.json();

    if (!userRes.ok || !discordUser.id) {
      return res.status(400).json({
        error: "Failed to fetch Discord user",
        detail: discordUser
      });
    }

    const avatarColor =
      AVATAR_COLORS[parseInt(discordUser.id.slice(-1), 10) % AVATAR_COLORS.length];

    const now = new Date();
    const db = await connectDB();
    const users = db.collection("users");

    await users.updateOne(
      { discordId: discordUser.id },
      {
        $set: {
          discordId: discordUser.id,
          username: discordUser.username,
          globalName: discordUser.global_name || null,
          discriminator: discordUser.discriminator || "0",
          avatar: discordUser.avatar || null,
          avatarColor: avatarColor,
          lastLoginAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );

    const savedUser = await users.findOne({ discordId: discordUser.id });

    return res.status(200).json({
      user: {
        id: savedUser.discordId,
        username: savedUser.username,
        discriminator: savedUser.discriminator,
        global_name: savedUser.globalName,
        avatar: savedUser.avatar,
        avatarColor: savedUser.avatarColor
      }
    });
  } catch (err) {
    console.error("[exchange]", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
