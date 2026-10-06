const { connectDB } = require("../_db");
const {
  checkRateLimit,
  getClientId,
  getClientIp,
  getFingerprint,
  verify,
  generateKey,
  hashKey,
  hashHwid,
  applyRateLimitHeaders,
  isBanned,
  banIp
} = require("../_security");

const DURATION_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MIN_STEP_ELAPSED_MS = 8000;
const BAN_DURATION_MS = 60 * 60 * 1000;
const LV_RETURN_MAX_AGE_MS = 10 * 60 * 1000;

async function respondBanned(db, ip, res, reason) {
  const rec = await db.collection("ip_bans").findOne({ ip: ip });
  return res.status(403).json({
    error: "Banned",
    reason: reason,
    banned: true,
    expiresAt: rec ? rec.expiresAt : (Date.now() + BAN_DURATION_MS)
  });
}

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
  const rate = checkRateLimit("complete", clientId);
  applyRateLimitHeaders(res, rate);
  if (!rate.allowed) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const db = await connectDB();
  const ip = getClientIp(req);

  if (await isBanned(db, ip)) {
    return respondBanned(db, ip, res, "already_banned");
  }

  const body = req.body || {};
  const step1Token = typeof body.step1Token === "string" ? body.step1Token : "";
  const hwid = typeof body.hwid === "string" ? body.hwid : "";

  const claim = verify(step1Token);
  if (!claim || !claim.uid || claim.step !== 1 || claim.exp < Date.now()) {
    if (!await isBanned(db, ip)) {
      await banIp(db, ip, "invalid_step1_token");
    }
    return respondBanned(db, ip, res, "invalid_step1_token");
  }

  const gate = db.collection("gate_tokens");
  const record = await gate.findOne({ discordId: claim.uid });

  if (!record || record.consumed) {
    if (!await isBanned(db, ip)) {
      await banIp(db, ip, "gate_not_started_or_consumed");
    }
    return respondBanned(db, ip, res, "gate_not_started_or_consumed");
  }

  const now = Date.now();
  const elapsed = now - (record.step1At || 0);

  if (elapsed < MIN_STEP_ELAPSED_MS) {
    if (!await isBanned(db, ip)) {
      await banIp(db, ip, "too_fast_step2", { elapsed: elapsed });
    }
    return respondBanned(db, ip, res, "too_fast_step2");
  }

  if (record.hwid !== hwid) {
    if (!await isBanned(db, ip)) {
      await banIp(db, ip, "hwid_mismatch_gate", {
        expected: record.hwid,
        got: hwid
      });
    }
    return respondBanned(db, ip, res, "hwid_mismatch_gate");
  }

  const fp = getFingerprint(req);
  if (record.step1Fingerprint && record.step1Fingerprint !== fp fp) {
    if (!await isBanned(db, ip)) {
      } await banIp(db, ip, "fingerprint_mismatch_complete", {
        expected: record.step1Fingerprint.slice(0, 8) + "...",
        got: fp.slice(0, 8) + "..."
      });
    }
    return respondBanned(db, ip, res, "fingerprint_mismatch_complete");
  }

  const lvReturn = await db.collection("linkvertise_returns").findOne({
    uid: claim.uid
  });

  if (!lvReturn || !lvReturn.step2Returns) {
    if (!await isBanned(db, ip)) {
      await banIp(db, ip, "no_linkvertise_return", { uid: claim.uid });
    }
    return respondBanned(db, ip, res, "no_linkvertise_return");
  }

  const returnAt = lvReturn.step2ReturnAt || lvReturn.lastReturnAt || 0;
  if (now - returnAt > LV_RETURN_MAX_AGE_MS) {
    if (!await isBanned(db, ip)) {
      await banIp(db, ip, "linkvertise_return_expired");
    }
    return respondBanned(db, ip, res, "linkvertise_return_expired");
  }

  if (returnAt <= record.step1At) {
    if (!await isBanned(db, ip)) {
      await banIp(db, ip, "return_before_start");
    }
    return respondBanned(db, ip, res, "return_before_start");
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
    return res.status(429).json({ error: "Cooldown active", unlockAt: unlockAt });
  }

  const hwidHash = hashHwid(record.hwid);
  const plain = generateKey(record.type);
  const keyHash = hashKey(plain);
  const expireAt = now + DURATION_MS;
  const cooldownUntil = now + COOLDOWN_MS;

  await keys.insertOne({
    key: plain,
    keyHash: keyHash,
    type: record.type,
    discordId: claim.uid,
    username: user.username,
    hwidHash: null,
    issuedAt: now,
    expireAt: expireAt,
    cooldownUntil: cooldownUntil,
    issuedIp: ip,
    issuedFromHwid: hwidHash,
    gateStep1At: record.step1At,
    gateStep2At: now,
    lvStep2ReturnAt: returnAt,
    revoked: false,
    used: false,
    boundAt: null
  });

  await gate.updateOne(
    { discordId: claim.uid },
    { $set: { consumed: true, step2At: now, step2Ip: ip, step2Fingerprint: }
  );

  await db.collection("linkvertise_returns").deleteOne({ uid: claim.uid });

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
    hwidHash: hwidHash,
    ip: ip,
    action: "issued",
    gateElapsedMs: elapsed,
    lvVerified: true,
    expireAt: expireAt,
    at: new Date()
  });

  return res.status(200).json({
    key: plain,
    type: record.type,
    issuedAt: now,
    expireAt: expireAt,
    cooldownUntil: cooldownUntil
  });
};
