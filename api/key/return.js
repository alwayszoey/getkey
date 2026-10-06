const { connectDB } = require("../_db");
const {
  getClientIp,
  getFingerprint,
  isLinkvertiseReferer,
  banIp
} = require("../_security");

const STEP_MAX_AGE_MS = 20 * 60 * 1000;

async function denyAndBan(db, ip, reason, extra) {
  await banIp(db, ip, reason, extra);
  return { banned: true, reason: reason };
}

module.exports = async function handler(req, res) {
  const step = parseInt(req.query.step || "0", 10);

  if (step !== 1 && step !== 2) {
    return res.status(400).send("Invalid step");
  }

  try {
    const db = await connectDB();
    const ip = getClientIp(req);
    const fp = getFingerprint(req);
    const now = Date.now();

    if (!isLinkvertiseReferer(req)) {
      const ref = (req.headers["referer"] || req.headers["referrer"] || "(none)");
      await denyAndBan(db, ip, "return_invalid_referer", {
        step: step,
        referer: ref.slice(0, 200),
        ua: (req.headers["user-agent"] || "").slice(0, 200)
      });
      return res.status(403).send("Access denied");
    }

    const gate = await db.collection("gate_tokens")
      .find({})
      .sort({ step1At: -1 })
      .limit(1)
      .toArray();

    const record = gate && gate[0];

    if (!record || record.consumed) {
      await denyAndBan(db, ip, "return_no_active_session", { step: step });
      return res.status(403).send("Access denied");
    }

    if (now - (record.step1At || 0) > STEP_MAX_AGE_MS) {
      await denyAndBan(db, ip, "return_session_expired", { step: step });
      return res.status(403).send("Access denied");
    }

    if (record.step1Ip && record.step1Ip !== ip) {
      await denyAndBan(db, ip, "return_ip_mismatch", {
        expected: record.step1Ip,
        got: ip,
        step: step
      });
      return res.status(403).send("Access denied");
    }

    if (record.step1Fingerprint && record.step1Fingerprint !== fp) {
      await denyAndBan(db, ip, "return_fingerprint_mismatch", {
        expected: record.step1Fingerprint.slice(0, 8) + "...",
        got: fp.slice(0, 8) + "...",
        step: step
      });
      return res.status(403).send("Access denied");
    }

    const setObj = {
      ip: ip,
      fingerprint: fp,
      uid: record.discordId,
      lastStep: step,
      lastReturnAt: now
    };

    if (step === 1) {
      setObj.step1ReturnAt = now;
    } else {
      setObj.step2ReturnAt = now;
    }

    const incObj = {};
    incObj["step" + step + "Returns"] = 1;

    await db.collection("linkvertise_returns").updateOne(
      { uid: record.discordId },
      {
        $set: setObj,
        $setOnInsert: { firstSeenAt: now },
        $inc: incObj
      },
      { upsert: true }
    );

    const target = step === 1 ? "/?gate=step1" : "/?gate=step2";
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, target);
  } catch (err) {
    console.error("[return]", err.message);
    return res.status(500).send("Internal error");
  }
};
