const crypto = require("crypto");

const SECRET = process.env.SIGNING_SECRET || "";

if (!SECRET || SECRET.length < 32) {
  throw new Error("SIGNING_SECRET must be set (min 32 chars)");
}

const RATE_LIMITS = {
  exchange: { window: 60 * 1000, max: 10 },
  start: { window: 60 * 1000, max: 5 },
  complete: { window: 60 * 1000, max: 5 },
  issue: { window: 60 * 1000, max: 5 },
  verify: { window: 60 * 1000, max: 20 },
  status: { window: 60 * 1000, max: 30 },
  reset: { window: 60 * 1000, max: 3 }
};

const BAN_COLLECTION = "ip_bans";
const BAN_DURATION_MS = 60 * 60 * 1000;

const buckets = new Map();

function prune(now) {
  for (const entry of buckets.values()) {
    if (now - entry.start > entry.window * 2) {
      buckets.delete(entry.key);
    }
  }
}

function checkRateLimit(scope, identifier) {
  const rule = RATE_LIMITS[scope];
  if (!rule) {
    throw new Error("Unknown rate limit scope: " + scope);
  }

  const now = Date.now();
  prune(now);

  const key = scope + ":" + identifier;
  let entry = buckets.get(key);

  if (!entry || now - entry.start > rule.window) {
    entry = { key: key, start: now, count: 0, window: rule.window };
    buckets.set(key, entry);
  }

  entry.count += 1;

  const allowed = entry.count <= rule.max;
  const remaining = Math.max(0, rule.max - entry.count);
  const resetAt = entry.start + rule.window;

  return { allowed: allowed, remaining: remaining, resetAt: resetAt, limit: rule.max };
}

function getClientIp(req) {
  const h = req.headers || {};
  const fwd = h["x-forwarded-for"] || "";
  const first = fwd.split(",")[0].trim();
  return first || h["x-real-ip"] || "unknown";
}

function getClientId(req) {
  return getClientIp(req);
}

function getFingerprint(req) {
  const ip = getClientIp(req);
  const ua = (req.headers["user-agent"] || "").slice(0, 200);
  const lang = (req.headers["accept-language"] || "").slice(0, 100);
  const enc = (req.headers["accept-encoding"] || "").slice(0, 60);
  const raw = ip + "|" + ua + "|" + lang + "|" + enc;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function isLinkvertiseReferer(req) {
  const ref = (req.headers["referer"] || req.headers["referrer"] || "").toLowerCase();
  if (!ref) return false;
  return (
    ref.indexOf("linkvertise.com") !== -1 ||
    ref.indexOf("link-hub.net") !== -1 ||
    ref.indexOf("link-to.net") !== -1 ||
    ref.indexOf("up-to-down.net") !== -1 ||
    ref.indexOf("direct-link.net") !== -1 ||
    ref.indexOf("linkvertise.net") !== -1
  );
}

function sign(payload) {
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  const b64 = Buffer.from(data).toString("base64url");
  const hmac = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  return b64 + "." + hmac;
}

function verify(token) {
  if (typeof token !== "string" || token.indexOf(".") === -1) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const b64 = parts[0];
  const sig = parts[1];

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(b64)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch (err) {
    return null;
  }
}

function generateKey(type) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const seg = function (n) {
    let s = "";
    for (let i = 0; i < n; i++) {
      s += chars[crypto.randomInt(0, chars.length)];
    }
    return s;
  };
  return "XH-" + type.toUpperCase() + "-" + seg(4) + "-" + seg(4) + "-" + seg(4);
}

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function hashHwid(hwid) {
  return crypto
    .createHash("sha256")
    .update("hwid:" + hwid)
    .digest("hex")
    .slice(0, 32);
}

function applyRateLimitHeaders(res, rate) {
  res.setHeader("X-RateLimit-Limit", String(rate.limit));
  res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(rate.resetAt / 1000)));
}

async function isBanned(db, ip) {
  if (!ip || ip === "unknown") return false;
  const now = Date.now();
  const record = await db.collection(BAN_COLLECTION).findOne({
    ip: ip,
    expiresAt: { $gt: now }
  });
  return Boolean(record);
}

async function banIp(db, ip, reason, meta) {
  if (!ip || ip === "unknown") return;

  const now = Date.now();

  const existing = await db.collection(BAN_COLLECTION).findOne({
    ip: ip,
    expiresAt: { $gt: now }
  });

  if (existing) return;

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

  if (!banned) return false;

  const now = Date.now();
  const record = await db.collection(BAN_COLLECTION).findOne({ ip: ip });
  const remain = record ? Math.max(0, record.expiresAt - now) : BAN_DURATION_MS;

  res.status(403).json({
    error: "Banned",
    reason: record ? record.reason : "policy_violation",
    banned: true,
    expiresAt: record ? record.expiresAt : (now + BAN_DURATION_MS)
  });

  return true;
}

module.exports = {
  checkRateLimit: checkRateLimit,
  getClientIp: getClientIp,
  getClientId: getClientId,
  getFingerprint: getFingerprint,
  isLinkvertiseReferer: isLinkvertiseReferer,
  sign: sign,
  verify: verify,
  generateKey: generateKey,
  hashKey: hashKey,
  hashHwid: hashHwid,
  applyRateLimitHeaders: applyRateLimitHeaders,
  isBanned: isBanned,
  banIp: banIp,
  checkBanOrRespond: checkBanOrRespond
};
