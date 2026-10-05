const { connectDB } = require("../_db");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { discordId, oldHwid, newHwid } = req.body || {};
  if (!discordId || !newHwid) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const db = await connectDB();
    const users = db.collection("users");
    const keys = db.collection("keys");

    const result = await users.updateOne(
      { discordId },
      {
        $set: { lastHwid: newHwid, hwidResetAt: Date.now() },
        $push: { hwidHistory: { old: oldHwid || null, new: newHwid, at: Date.now() } }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // ยกเลิกคีย์ที่ผูกกับ HWID เก่า
    if (oldHwid) {
      await keys.updateMany(
        { discordId, hwid: oldHwid, used: false },
        { $set: { revoked: true, revokedAt: Date.now(), revokedReason: "hwid_reset" } }
      );
    }

    return res.status(200).json({ ok: true, hwid: newHwid });
  } catch (err) {
    console.error("[reset-hwid] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
