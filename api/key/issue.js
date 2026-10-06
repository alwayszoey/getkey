const { connectDB } = require("../_db");
const {
  checkRateLimit,
  getClientId,
  getClientIp,
  applyRateLimitHeaders,
  checkBanOrRespond,
  banIp
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
  const rate = checkRateLimit("issue", clientId);
  applyRateLimitHeaders(res, rate);
  if (!rate.allowed) return res.status(429).json({ error: "Too many requests" });

  const db = await connectDB();
  const ip = getClientIp(req);
  if (await checkBanOrRespond(db, ip, res)) return;

  await banIp(db, ip, "direct_issue_endpoint");

  return res.status(403).json({
    error: "Direct issue blocked",
    hint: "Use /api/key/start then /api/key/complete"
  });
};
