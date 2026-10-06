const BAN_COLLECTION = "ip_bans";
const BAN_DURATION_MS = 60 * 60 * 1000;

async function isBanned(db, ip) {
  if (!ip || ip === "unknown") return false;
  const now = Date.now();
  const record = await db.collection(BAN_COLLECTION).findOne({
    ip: ip,
    expiresAt: { $gt: now }
  });
  return !!record;
}

async function banIp(db, ip, reason, meta) {
  if (!ip || ip === "unknown") return;
  const now = Date.now();
  await db.collection(BAN_COLLECTION).updateOne(
    { ip: ip },
    {
      $set: {
        ip: ip,
        reason: reason || "policy_violation",
        meta: meta || {},
        bannedAt: new Date(now),
        expiresAt: now + BAN_DURATION_MS
      }
    },
    { upsert: true }
  );
}

async function checkBanOrRespond(db, ip, res) {
  const banned = await isBanned(db, ip);
  if (banned) {
    const now = Date.now();
    const record = await db.collection(BAN_COLLECTION).findOne({ ip: ip });
    const remain = record ? Math.max(0, record.expiresAt - now) : BAN_DURATION_MS;
    res.status(403).json({
      error: "Temporarily banned",
      reason: record ? record.reason : "policy_violation",
      retryAfterMs: remain
    });
    return true;
  }
  return false;
}

module.exports.isBanned = isBanned;
module.exports.banIp = banIp;
module.exports.checkBanOrRespond = checkBanOrRespond;
