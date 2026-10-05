(function () {
  "use strict";

  var TRIGGERED = false;

  var ROAST_LINES = [
    "%c หยุดเลยครับพี่",
    "%c แจกฟรีขนาดนี้ยังจะหา bypass อีกหรอ 555",
    "%c เขียนด่าในโค้ดให้แล้วนะ อ่านเอา",
    "%c ขยันแบบนี้ไปทำงานหาเงินซื้อเองก็ได้แล้ว",
    "%c ดาวน์โหลดเกมเถื่อนยังง่ายกว่าเลยมึง",
    "%c Ctrl+Shift+I ปิดไปเถอะครับ อยู่นานเดี๋ยว Server หนัก",
    "%c พี่ครับ พี่ทำแบบนี้พี่ไม่ละอายใจหรอ",
    "%c อุตส่าห์เขียนโค้ดให้ฟรี ยังจะแกะอีก",
    "%c เห็นแล้วเหนื่อยแทนแอดมิน",
    "%c หา bypass ไปก็ไม่มีอะไรให้ขโมยหรอก คีย์ฟรีอยู่แล้ว",
    "%c โค้ด CSS สวย ๆ ก็ดูดไปเถอะ ยังไงก็ฟรี",
    "%c เก่งจังเลยครับ ขอถ่ายรูปเก็บไว้หน่อยนะ",
    "%c เปิดไปก็ได้ครับ แต่ไม่มีอะไรซ่อนอยู่จริง ๆ",
    "%c พี่ครับ ผมก็คนนะครับ",
    "%c อ๋อ เปิด F12 เก่งจัง อยากปรบมือให้"
  ];

  var BAN_TITLE = "🚫 GET OUT";
  var originalTitle = document.title;

  function showRoast() {
    var style1 = "font-size:20px;font-weight:900;color:#f87171;background:#1a0000;padding:6px 14px;border-radius:6px;text-shadow:0 0 8px #f87171;";
    var style2 = "font-size:13px;font-weight:600;color:#fca5a5;background:#1a0000;padding:4px 10px;border-radius:4px;";
    var style3 = "font-size:11px;color:#a1a1aa;font-style:italic;padding:2px 8px;";

    var roasts = [
      "หยุดเลยครับพี่",
      "แจกฟรีขนาดนี้ยังจะหา bypass อีกหรอ 555",
      "ขยันแบบนี้ไปทำงานหาเงินซื้อเองก็ได้แล้ว",
      "อุตส่าห์เขียนโค้ดให้ฟรี ยังจะแกะอีก",
      "หา bypass ไปก็ไม่มีอะไรให้ขโมยหรอก คีย์ฟรีอยู่แล้ว",
      "พี่ครับ ผมก็คนนะครับ",
      "เก่งจังเลยครับ ขอถ่ายรูปเก็บไว้หน่อยนะ"
    ];

    console.clear();
    console.log("%c 🔒 SECURITY ALERT", style1);
    console.log("%c โค้ดนี้เขียนด่าไว้ตรงนี้เลย อ่านได้เลยครับ :)", style2);

    for (var i = 0; i < roasts.length; i++) {
      console.log("%c" + roasts[i], style3);
    }

    console.log("%c ----------------------------------", style3);
    console.log("%c คีย์ฟรี 100% ไม่มีอะไรต้อง bypass", style2);
    console.log("%c ปิด DevTools แล้วกลับไปกดปุ่ม Get key เถอะครับ", style3);
  }

  function showOverlay() {
    if (document.getElementById("__guard_overlay")) return;

    var overlay = document.createElement("div");
    overlay.id = "__guard_overlay";
    overlay.innerHTML =
      '<div class="guard-box">' +
      '  <div class="guard-emoji">🚫</div>' +
      '  <div class="guard-title">ปิด DevTools เถอะครับพี่</div>' +
      '  <div class="guard-sub">' +
      '    แจกฟรีขนาดนี้แล้ว ยังจะหา bypass อีกหรอ 555<br>' +
      '    ปิด F12 แล้วกดโหลดหน้าใหม่นะ' +
      '  </div>' +
      '  <div class="guard-hint">F5 / ปิด tab แล้วเข้าใหม่</div>' +
      '</div>';

    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:999999",
      "background:#08090a",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:24px",
      "font-family:system-ui,-apple-system,sans-serif",
      "text-align:center",
      "color:#fafafa",
      "animation:guardFadeIn .25s ease"
    ].join(";");

    var style = document.createElement("style");
    style.textContent =
      "@keyframes guardFadeIn{from{opacity:0}to{opacity:1}}" +
      ".guard-box{max-width:420px}" +
      ".guard-emoji{font-size:56px;margin-bottom:20px;animation:guardPulse 1s ease infinite}" +
      "@keyframes guardPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}" +
      ".guard-title{font-size:22px;font-weight:800;color:#f87171;margin-bottom:12px;letter-spacing:-0.02em}" +
      ".guard-sub{font-size:14px;color:#a1a1aa;line-height:1.7;margin-bottom:20px}" +
      ".guard-hint{font-size:11px;color:#52525b;padding:8px 14px;background:#18181b;border:1px solid #27272a;border-radius:8px;display:inline-block;font-family:monospace}";

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    document.title = BAN_TITLE;

    try {
      document.body.style.overflow = "hidden";
    } catch (e) {}
  }

  function nuke() {
    if (TRIGGERED) return;
    TRIGGERED = true;

    showRoast();
    showOverlay();

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
  }

  function reset() {
    if (!TRIGGERED) return;
    var ov = document.getElementById("__guard_overlay");
    if (ov) ov.remove();
    document.title = originalTitle;
    TRIGGERED = false;
    try {
      document.body.style.overflow = "";
    } catch (e) {}
  }

  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toUpperCase();
    if (e.key === "F12" || e.keyCode === 123) {
      e.preventDefault(); e.stopPropagation(); return false;
    }
    if (e.ctrlKey && e.shiftKey && ["I","J","C"].indexOf(k) !== -1) {
      e.preventDefault(); e.stopPropagation(); return false;
    }
    if (e.ctrlKey && k === "U") {
      e.preventDefault(); e.stopPropagation(); return false;
    }
    if (e.ctrlKey && k === "S") {
      e.preventDefault(); e.stopPropagation(); return false;
    }
    if (e.metaKey && e.altKey && ["I","J","C"].indexOf(k) !== -1) {
      e.preventDefault(); e.stopPropagation(); return false;
    }
    if (e.metaKey && k === "U") {
      e.preventDefault(); e.stopPropagation(); return false;
    }
    if (e.metaKey && k === "S") {
      e.preventDefault(); e.stopPropagation(); return false;
    }
  }, true);

  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    return false;
  }, true);

  document.addEventListener("selectstart", function (e) {
    e.preventDefault();
  }, true);
  document.addEventListener("dragstart", function (e) {
    e.preventDefault();
  }, true);

  function checkSize() {
    var w = window.outerWidth - window.innerWidth > 160;
    var h = window.outerHeight - window.innerHeight > 160;
    if (w || h) nuke();
    else reset();
  }
  setInterval(checkSize, 600);
  window.addEventListener("resize", checkSize);

  setInterval(function () {
    var start = performance.now();
    debugger;
    var end = performance.now();
    if (end - start > 100) nuke();
  }, 1500);

  var probe = /./;
  probe.toString = function () {
    nuke();
    return "";
  };
  setInterval(function () {
    try { console.log(probe); } catch (e) {}
  }, 1500);

  var probe2 = new Image();
  Object.defineProperty(probe2, "id", {
    get: function () {
      nuke();
      return "";
    }
  });
  setInterval(function () {
    try { console.log(probe2); } catch (e) {}
  }, 1800);

  if (window.top !== window.self) {
    try {
      window.top.location = window.self.location;
    } catch (e) {
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;' +
        'min-height:100vh;background:#08090a;color:#fb7185;' +
        'font-family:system-ui;text-align:center;padding:20px;">' +
        '<div><h1 style="font-size:20px;">Access Denied</h1></div></div>';
    }
  }

  try {
    var noop = function () {};
    Object.defineProperty(window, "console", {
      get: function () {
        return {
          log: noop, warn: noop, error: noop,
          info: noop, debug: noop, table: noop,
          clear: noop, dir: noop, trace: noop
        };
      },
      configurable: false
    });
  } catch (e) {}

  try {
    var allowed = [
      "getkey_cooldown_until",
      "getkey_hwid",
      "getkey_key",
      "getkey_discord_user",
      "getkey_oauth_state",
      "getkey_access_token"
    ];
    var originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (allowed.indexOf(key) === -1) return;
      originalSet.call(this, key, value);
    };
  } catch (e) {}

  try {
    Object.defineProperty(window, "GetkeyAuth", {
      configurable: false,
      writable: false
    });
  } catch (e) {}

  try {
    var s = "font-size:16px;font-weight:800;color:#f87171;";
    var t = "font-size:12px;color:#a1a1aa;";
    setTimeout(function () {
    }, 0);
  } catch (e) {}
})();
