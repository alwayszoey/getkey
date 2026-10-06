const { connectDB } = require("../_db");
const {
  checkRateLimit,
  getClientId,
  getClientIp,
  verify,
  hashHwid,
  applyRateLimitHeaders,
  checkBanOrRespond
} = require("../_security");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientId = getClientId(req);
  const rate = checkRateLimit("reset", clientId);
  applyRateLimitHeaders(res, rate);
  if (!rate.allowed) return res.status(429).json({ error: "Too many requests" });

  const db = await connectDB();
  const ip = getClientIp(req);
  if (await checkBanOrRespond(db, ip, res)) return;

  const body = req.body || {};
  const session = typeof body.session === "string" ? body.session : "";
  const newHwid = typeof body.newHwid === "string" ? body.newHwid : "";

  if (!newHwid || newHwid.length < 8 || newHwid.length > 256) {
    return res.status(400).json({ error: "Invalid hardware id" });
  }

  const claim = verify(session);
  if (!claim || !claim.uid || claim.exp < Date.now()) {
    return res.status(401).json({ error: "Invalid session" });
  }

  try {
    const users = db.collection("users");
    const keys = db.collection("keys");

    const now = Date.now();
    const newHash = hashHwid(newHwid);

    const user = await users.findOne({ discordId: claim.uid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await users.updateOne(
      { discordId: claim.uid },
      {
        $set: {
          lastHwidHash: newHash,
          hwidResetAt: now
        },
        $push: {
          hwidHistory: {
            previous: user.lastHwidHash || null,
            current: newHash,
            at: now,
            ip
          }
        }
      }
    );

    await keys.updateMany(
      { discordId: claim.uid, revoked: false },
      {
        $set: {
          revoked: true,
          revokedAt: now,
          revokedReason: "hwid_reset"
        }
      }
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[reset-hwid]", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
};
