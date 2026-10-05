(function () {
  "use strict";

  var LINES = [
    "หยุดตรงนี้เลยครับพี่",
    "คีย์กูแจกฟรีอยู่แล้ว จะหา bypass กันไปทำไม",
    "อ่านตรงนี้แล้วสำนึกซะนะ",
    "โค้ดทั้งหมดอยู่บน server ฝั่งนี้แกะไปก็ไม่มีอะไร",
    "rate limit ก็มี ban ก็มี ทำตัวดี ๆ เถอะ",
    "เขียนฟรีให้ด้วยใจ อย่าให้ต้องปิดเว็บเลย"
  ];

  var S1 = "color:#ef4444;font-size:20px;font-weight:900;";
  var S2 = "color:#fca5a5;font-size:13px;font-weight:700;";
  var S3 = "color:#71717a;font-size:11px;font-style:italic;";

  var fired = false;

  function stamp() {
    if (fired) return;
    fired = true;

    try { console.clear(); } catch (e) {}

    try {
      console.log("%cหยุดครับ", S1);
      for (var i = 0; i < LINES.length; i++) {
        console.log("%c" + LINES[i], i % 2 ? S3 : S2);
      }
    } catch (e) {}
  }

  setInterval(function () {
    if (!fired) return;
    try { console.log("%cยังอยู่อีกเหรอ", S3); } catch (e) {}
  }, 3000);

  function probe() {
    if (window.outerWidth - window.innerWidth > 160) stamp();
    if (window.outerHeight - window.innerHeight > 160) stamp();
  }

  setInterval(probe, 700);
  window.addEventListener("resize", probe);

  setInterval(function () {
    var s = performance.now();
    debugger;
    if (performance.now() - s > 80) stamp();
  }, 1500);
})();
