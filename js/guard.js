(function () {
  "use strict";

  var PHRASES = [
    "มึงจะหา bypass ทำไม คีย์กูแจกฟรีอยู่แล้ว สมองมีไว้คิดหรือมีไว้ประดับ",
    "เปิด F12 มาหวังอะไร คิดว่ากูโง่เหรอ เขียนโค้ดมากี่ปีมึงรู้ป่าว",
    "ขโมยของฟรีไม่ละอายใจ ครอบครัวมึงสอนมารึเปล่า",
    "กูเขียนฟรีให้เพราะอยากแจก แต่มีพวกแบบมึงนี่แหละที่ทำให้คนเลิกทำ",
    "มึงคิดว่ากูไม่เห็นเหรอ ทุกอย่างที่มึงกดมัน log หมด",
    "หาประโยชน์จากของฟรี อนาคตมึงจะไปรอดไหม",
    "สมองมึงเอาไว้ทำอะไร คิดหากินกับของฟรีหรือไง",
    "กูอุตส่าห์เสียเวลาทำให้ แล้วมึงมาแบบนี้ ใจมึงทำด้วยอะไร",
    "เด็กสมัยนี้แจกฟรียังไม่พอใจ อยากได้มากกว่านี้อีก",
    "อย่ามาเถียง อย่ามาอ้าง มึงรู้ตัวว่ากำลังทำอะไรอยู่"
  ];

  var S1 = "color:#ef4444;font-size:26px;font-weight:900;text-shadow:0 0 20px #ef4444;padding:6px 0;";
  var S2 = "color:#fca5a5;font-size:15px;font-weight:800;padding:3px 0;";
  var S3 = "color:#71717a;font-size:12px;font-style:italic;padding:1px 0;";
  var S4 = "color:#52525b;font-size:11px;font-family:monospace;padding:1px 0;";

  var fired = false;

  function stamp() {
    if (fired) return;
    fired = true;

    try { console.clear(); } catch (e) {}

    try {
      console.log("%c ", S1);
      console.log("%c   หยุดตรงนี้เลย", S1);
      console.log("%c   กูเขียนฟรีให้ มึงจะมาแกะทำไม", S2);
      console.log("%c   อ่านให้ครบทุกบรรทัด แล้วสำนึกซะ", S2);
      console.log("%c ", S1);
    } catch (e) {}

    PHRASES.forEach(function (line, i) {
      try {
        console.log("%c" + line, i % 2 ? S3 : S4);
      } catch (e) {}
    });

    try {
      console.log("%c ", S3);
      console.log("%c อย่ามีหน้าทำแบบนี้อีกนะมึง เข้าใจไหม", S2);
      console.log("%c ", S3);
    } catch (e) {}
  }

  setInterval(function () {
    if (!fired) return;
    try {
      var t = performance.now();
      console.log("%cยังอยู่ ยังไม่สำนึก ยังไม่หยุด :)", S3);
      if (performance.now() - t > 60) stamp();
    } catch (e) {}
  }, 2000);

  function probe() {
    var gw = window.outerWidth - window.innerWidth;
    var gh = window.outerHeight - window.innerHeight;
    if (gw > 160 || gh > 160) stamp();
  }

  setInterval(probe, 700);
  window.addEventListener("resize", probe);

  setInterval(function () {
    var s = performance.now();
    debugger;
    if (performance.now() - s > 80) stamp();
  }, 1200);

  var decoy = /x/;
  decoy.toString = function () { stamp(); return "x"; };
  setInterval(function () {
    try { console.log(decoy); } catch (e) {}
  }, 1400);

  var node = document.createElement("div");
  Object.defineProperty(node, "id", {
    get: function () { stamp(); return ""; }
  });
  setInterval(function () {
    try { console.log(node); } catch (e) {}
  }, 1700);

  document.addEventListener("keydown", function (ev) {
    var k = (ev.key || "").toUpperCase();
    if (ev.key === "F12" || ev.keyCode === 123) {
      ev.preventDefault();
      stamp();
      return false;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && "IJC".indexOf(k) > -1) {
      ev.preventDefault();
      stamp();
      return false;
    }
    if ((ev.ctrlKey || ev.metaKey) && (k === "U" || k === "S")) {
      ev.preventDefault();
      stamp();
      return false;
    }
  }, true);

  document.addEventListener("contextmenu", function (ev) {
    ev.preventDefault();
  }, true);
})();
