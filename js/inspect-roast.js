(function () {
  "use strict";

  var LINES = [
    "Stop right there.",
    "Everything is server-side. Nothing to find here.",
    "You are wasting your time inspecting this page.",
    "Rate limits and IP bans are active on the API.",
    "The gate is enforced on the backend, not the client.",
    "Good luck, but you will not get anything from here."
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
      console.log("%cHalt", S1);
      for (var i = 0; i < LINES.length; i++) {
        console.log("%c" + LINES[i], i % 2 ? S3 : S2);
      }
    } catch (e) {}
  }

  setInterval(function () {
    if (!fired) return;
    try { console.log("%cStill here?", S3); } catch (e) {}
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
