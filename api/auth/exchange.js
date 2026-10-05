const { connectDB } = require("../_db");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, redirect_uri } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  const {
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI
  } = process.env;

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(500).json({ error: "Discord credentials missing" });
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect_uri || DISCORD_REDIRECT_URI
      })
    });

    const token = await tokenRes.json();
    if (!token.access_token) {
      return res.status(400).json({ error: "Token exchange failed", detail: token });
    }

    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const discordUser = await userRes.json();

    if (!discordUser.id) {
      return res.status(400).json({ error: "Failed to fetch user" });
    }

    const colors = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245"];
    const avatarColor = colors[parseInt(discordUser.id.slice(-1), 10) % colors.length];

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
          avatarColor,
          lastLoginAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );

    const saved = await users.findOne({ discordId: discordUser.id });

    return res.status(200).json({
      user: {
        id: saved.discordId,
        username: saved.username,
        discriminator: saved.discriminator,
        global_name: saved.globalName,
        avatar: saved.avatar,
        avatarColor: saved.avatarColor
      }
    });
  } catch (err) {
    console.error("[exchange] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
