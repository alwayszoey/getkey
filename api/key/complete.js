const { connectDB } = require("../_db");
const {
  checkRateLimit,
  getClientId,
  getClientIp,
  verify,
  generateKey,
  hashKey,
  hashHwid,
  applyRateLimitHeaders,
  checkBanOrRespond,
  banIp
} = require("../_security");

const DURATION_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
  const rate = checkRateLimit("issue", clientId);
  applyRateLimitHeaders(res, rate);
  if (!rate.allowed) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const db = await connectDB();
  const ip = getClientIp(req);

  if (await checkBanOrRespond(db, ip, res)) return;

  const body = req.body || {};
  const step1Token = typeof body.step1Token === "string" ? body.step1Token : "";

  const claim = verify(step1Token);
  if (!claim || !claim.uid || claim.step !== 1 || claim.exp < Date.now()) {
    await banIp(db, ip, "invalid_step1_token");
    return res.status(401).json({ error: "Invalid or expired step token" });
  }

  const gate = db.collection("gate_tokens");
  const record = await gate.findOne({ discordId: claim.uid });

  if (!record || record.consumed) {
    await banIp(db, ip, "gate_not_started_or_consumed");
    return res.status(403).json({ error: "Gate already consumed or not started" });
  }

  const now = Date.now();
  const elapsed = now - (record.step1At || 0);

  if (elapsed < 3000) {
    await banIp(db, ip, "too_fast_step2", { elapsed });
    return res.status(403).json({ error: "Too fast, complete the steps properly" });
  }

  if (record.hwid !== body.hwid) {
    await banIp(db, ip, "hwid_mismatch_gate", { expected: record.hwid, got: body.hwid });
    return res.status(403).json({ error: "HWID mismatch" });
  }

  const users = db.collection("users");
  const keys = db.collection("keys");
  const logs = db.collection("key_logs");

  const user = await users.findOne({ discordId: claim.uid });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const locked = await keys.findOne({
    discordId: claim.uid,
    $or: [
      { cooldownUntil: { $gt: now } },
      { expireAt: { $gt: now } }
    ]
  });

  if (locked) {
    const unlockAt = Math.max(locked.cooldownUntil || 0, locked.expireAt || 0);
    await gate.updateOne({ discordId: claim.uid }, { $set: { consumed: true } });
    return res.status(429).json({ error: "Cooldown active", unlockAt });
  }

  const hwidHash = hashHwid(record.hwid);
  const plain = generateKey(record.type);
  const keyHash = hashKey(plain);
  const expireAt = now + DURATION_MS;
  const cooldownUntil = now + COOLDOWN_MS;

  await keys.insertOne({
    keyHash,
    type: record.type,
    discordId: claim.uid,
    username: user.username,
    hwidHash: null,
    issuedAt: now,
    expireAt,
    cooldownUntil,
    issuedIp: ip,
    issuedFromHwid: hwidHash,
    gateStep1At: record.step1At,
    gateStep2At: now,
    revoked: false,
    used: false,
    boundAt: null
  });

  await gate.updateOne(
    { discordId: claim.uid },
    { $set: { consumed: true, step2At: now, step2Ip: ip } }
  );

  await users.updateOne(
    { discordId: claim.uid },
    {
      $set: { lastHwidHash: hwidHash, lastKeyAt: now },
      $inc: { totalKeys: 1 }
    }
  );

  await logs.insertOne({
    discordId: claim.uid,
    username: user.username,
    type: record.type,
    hwidHash,
    ip,
    action: "issued",
    gateElapsedMs: elapsed,
    expireAt,
    at: new Date()
  });

  return res.status(200).json({
    key: plain,
    type: record.type,
    issuedAt: now,
    expireAt,
    cooldownUntil
  });
};
