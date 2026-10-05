const { connectDB } = require("../_db");
const { checkRateLimit, getClientId, hashKey, hashHwid, applyRateLimitHeaders } = require("../_security");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientId = getClientId(req);
  const rate = checkRateLimit("verify", clientId);
  applyRateLimitHeaders(res, rate);
  if (!rate.allowed) {
    return res.status(429).json({ valid: false, error: "Too many requests" });
  }

  const body = req.body || {};
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const hwid = typeof body.hwid === "string" ? body.hwid : "";

  if (!key || key.length > 64) {
    return res.status(400).json({ valid: false, error: "Invalid key format" });
  }

  if (!hwid || hwid.length < 8) {
    return res.status(400).json({ valid: false, error: "Invalid hardware id" });
  }

  try {
    const db = await connectDB();
    const keys = db.collection("keys");

    const keyHash = hashKey(key);
    const hwidHash = hashHwid(hwid);
    const now = Date.now();

    const record = await keys.findOne({ keyHash });

    if (!record) {
      return res.status(200).json({ valid: false, reason: "not_found" });
    }

    if (record.revoked) {
      return res.status(200).json({ valid: false, reason: "revoked" });
    }

    if (record.expireAt && record.expireAt < now) {
      return res.status(200).json({ valid: false, reason: "expired" });
    }

    if (record.hwidHash && record.hwidHash !== hwidHash) {
      return res.status(200).json({ valid: false, reason: "hwid_mismatch" });
    }

    return res.status(200).json({
      valid: true,
      expiresAt: record.expireAt,
      type: record.type
    });
  } catch (err) {
    console.error("[verify]", err.message);
    return res.status(500).json({ valid: false, error: "Internal error" });
  }
};
