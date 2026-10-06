const { connectDB } = require("../_db");
const {
  checkRateLimit,
  getClientId,
  getClientIp,
  sign,
  verify,
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
  const rate = checkRateLimit("start", clientId);
  applyRateLimitHeaders(res, rate);
  if (!rate.allowed) return res.status(429).json({ error: "Too many requests" });

  const db = await connectDB();
  const ip = getClientIp(req);
  if (await checkBanOrRespond(db, ip, res)) return;

  const body = req.body || {};
  const hwid = typeof body.hwid === "string" ? body.hwid : "";
  const session = typeof body.session === "string" ? body.session : "";
  const type = typeof body.type === "string" ? body.type : "";

  if (type !== "1day") {
    return res.status(400).json({ error: "Invalid key type" });
  }

  if (!hwid || hwid.length < 8 || hwid.length > 256) {
    return res.status(400).json({ error: "Invalid hardware id" });
  }

  const claim = verify(session);
  if (!claim || !claim.uid || claim.exp < Date.now()) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const users = db.collection("users");
  const user = await users.findOne({ discordId: claim.uid });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const gate = db.collection("gate_tokens");

  await gate.updateOne(
    { discordId: claim.uid },
    {
      $set: {
        discordId: claim.uid,
        hwid: hwid,
        type: type,
        step1At: Date.now(),
        step1Ip: ip,
        step2At: null,
        step2Ip: null,
        consumed: false
      }
    },
    { upsert: true }
  );

  const step1Token = sign({
    uid: claim.uid,
    step: 1,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 10
  });

  return res.status(200).json({
    step1Token,
    linkvertiseStep1: process.env.LINKVERTISE_STEP1_URL || null,
    linkvertiseStep2: process.env.LINKVERTISE_STEP2_URL || null
  });
};
