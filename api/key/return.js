const { connectDB } = require("../_db");
const { getClientIp } = require("../_security");

module.exports = async function handler(req, res) {
  const step = parseInt(req.query.step || "0", 10);

  if (step !== 1 && step !== 2) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).send("Invalid step");
  }

  try {
    const db = await connectDB();
    const ip = getClientIp(req);
    const now = Date.now();

    const setObj = {
      ip: ip,
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
      { ip: ip },
      {
        $set: setObj,
        $setOnInsert: { firstSeenAt: now },
        $inc: incObj
      },
      { upsert: true }
    );

    const target = step === 1
      ? "/?gate=step1"
      : "/?gate=step2";

    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, target);
  } catch (err) {
    console.error("[return]", err.message);
    return res.status(500).send("Internal error");
  }
};
