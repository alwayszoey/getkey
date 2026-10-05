const Guard = (() => {
  const state = {
    triggered: false,
    triggeredAt: 0,
    originalTitle: document.title,
    ip: null,
    ipLoaded: false,
  };

  const ALLOWED_KEYS = [
    "getkey_cooldown_until",
    "getkey_hwid",
    "getkey_key",
    "getkey_discord_user",
    "getkey_oauth_state",
    "getkey_access_token",
  ];

  const ROASTS = [
    "แจกฟรีขนาดนี้ยังจะหา bypass อีกหรอ 555",
    "ขยันแบบนี้ไปทำงานหาเงินซื้อเองก็ได้แล้ว",
    "อุตส่าห์เขียนโค้ดให้ฟรี ยังจะแกะอีก",
    "หา bypass ไปก็ไม่มีอะไรให้ขโมยหรอก คีย์ฟรีอยู่แล้ว",
    "พี่ครับ ผมก็คนนะครับ",
    "เก่งจังเลยครับ ขอถ่ายรูปเก็บไว้หน่อยนะ",
    "เปิด DevTools เก่งขนาดนี้ ไปสมัครงานเป็น dev ได้เลย",
    "โค้ด CSS สวย ๆ ก็ดูดไปเถอะ ยังไงก็ฟรี",
  ];

  const CAT_SVG = `
    <svg class="guard-cat" viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg"
         fill="none" stroke="#f87171" stroke-width="3"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M 60 40 L 55 15 L 78 32 Q 100 25 122 32 L 145 15 L 140 40
               Q 155 60 155 85 Q 155 130 100 130 Q 45 130 45 85 Q 45 60 60 40 Z"
            fill="#1a0000"/>
      <circle cx="78" cy="75" r="6" fill="#f87171"/>
      <circle cx="122" cy="75" r="6" fill="#f87171"/>
      <path d="M 100 88 L 95 95 L 105 95 Z" fill="#f87171"/>
      <path d="M 92 108 Q 100 102 108 108"/>
      <line x1="30" y1="85" x2="55" y2="90"/>
      <line x1="30" y1="95" x2="55" y2="97"/>
      <line x1="170" y1="85" x2="145" y2="90"/>
      <line x1="170" y1="95" x2="145" y2="97"/>
    </svg>
  `;

  const CSS = `
    @keyframes guardFadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes guardPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.04) } }
    #__guard_overlay {
      position: fixed; inset: 0; z-index: 999999;
      background: #08090a;
      display: flex; align-items: center; justify-content: center;
      padding: 24px; overflow-y: auto;
      font-family: 'IBM Plex Sans Thai', system-ui, sans-serif;
      text-align: center; color: #fafafa;
      animation: guardFadeIn .25s ease;
    }
    .guard-box { max-width: 440px; padding: 16px 0; }
    .guard-cat {
      width: 120px; height: 96px; margin: 0 auto 20px; display: block;
      animation: guardPulse 2s ease infinite;
      filter: drop-shadow(0 0 20px rgba(248,113,113,.4));
    }
    .guard-title {
      font-size: 22px; font-weight: 800; color: #f87171;
      margin-bottom: 12px; letter-spacing: -.02em;
    }
    .guard-sub {
      font-size: 14px; color: #a1a1aa;
      line-height: 1.7; margin-bottom: 20px;
    }
    .guard-ip-box {
      background: #1a0a0a;
      border: 1px solid rgba(248,113,113,.35);
      border-radius: 10px; padding: 14px; margin-bottom: 20px;
    }
    .guard-ip-label {
      font-size: 10px; color: #f87171; letter-spacing: .15em;
      font-weight: 700; text-transform: uppercase; margin-bottom: 4px;
    }
    .guard-ip-value {
      font-family: 'Courier New', monospace;
      font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px;
    }
    .guard-ip-warn { font-size: 11px; color: #fca5a5; line-height: 1.5; }
    .guard-hint {
      font-size: 11px; color: #52525b;
      padding: 8px 14px; background: #18181b;
      border: 1px solid #27272a; border-radius: 8px;
      display: inline-block; font-family: monospace;
    }
  `;

  const HOLD_MS = 5000;

  function randRoast() {
    return ROASTS[Math.floor(Math.random() * ROASTS.length)];
  }

  function fetchIp() {
    return new Promise((resolve) => {
      if (state.ipLoaded) return resolve(state.ip);
      fetch("https://api.ipify.org?format=json")
        .then((r) => r.json())
        .then((d) => {
          state.ip = d.ip || "unknown";
          state.ipLoaded = true;
          resolve(state.ip);
        })
        .catch(() => {
          state.ip = "unknown";
          state.ipLoaded = true;
          resolve(state.ip);
        });
    });
  }

  function mountStyle() {
    if (document.getElementById("__guard_style")) return;
    const s = document.createElement("style");
    s.id = "__guard_style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  async function showOverlay() {
    if (document.getElementById("__guard_overlay")) return;
    mountStyle();

    const ip = await fetchIp();

    const overlay = document.createElement("div");
    overlay.id = "__guard_overlay";
    overlay.innerHTML = `
      <div class="guard-box">
        ${CAT_SVG}
        <div class="guard-title">ปิด DevTools เถอะครับพี่</div>
        <div class="guard-sub">${randRoast()}</div>
        <div class="guard-ip-box">
          <div class="guard-ip-label">IP ของคุณ</div>
          <div class="guard-ip-value">${ip}</div>
          <div class="guard-ip-warn">IP นี้ถูกบันทึกไว้ในฐานข้อมูลแล้ว · อย่าทำอีก</div>
        </div>
        <div class="guard-hint">F5 / ปิด tab แล้วเข้าใหม่</div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.title = "SECURITY ALERT";
    document.body.style.overflow = "hidden";
  }

  function hideOverlay() {
    const el = document.getElementById("__guard_overlay");
    if (el) el.remove();
    document.title = state.originalTitle;
    document.body.style.overflow = "";
  }

  function trigger() {
    if (state.triggered) return;
    state.triggered = true;
    state.triggeredAt = Date.now();

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}

    showOverlay();
  }

  function clear() {
    if (!state.triggered) return;
    // กัน clear ทันทีหลัง trigger (จาก debounce สลับ)
    if (Date.now() - state.triggeredAt < HOLD_MS) return;
    state.triggered = false;
    hideOverlay();
  }

  function blockKeys() {
    document.addEventListener(
      "keydown",
      (e) => {
        const k = (e.key || "").toUpperCase();
        if (e.key === "F12" || e.keyCode === 123) return e.preventDefault();
        if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(k))
          return e.preventDefault();
        if (e.ctrlKey && (k === "U" || k === "S")) return e.preventDefault();
        if (e.metaKey && e.altKey && ["I", "J", "C"].includes(k))
          return e.preventDefault();
        if (e.metaKey && (k === "U" || k === "S")) return e.preventDefault();
      },
      true
    );
  }

  function blockMouse() {
    ["contextmenu", "selectstart", "dragstart"].forEach((evt) => {
      document.addEventListener(evt, (e) => e.preventDefault(), true);
    });
  }

  // size check — เฉพาะตอน orientation จริง ๆ เปลี่ยน
  let sizeTimer = null;
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;

  function onResize() {
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(() => {
      const curW = window.innerWidth;
      const curH = window.innerHeight;

      // ถ้าขนาด viewport ไม่เปลี่ยนมาก ถือว่าเป็นแค่ devtools เปิด/ปิด
      const viewportChanged =
        Math.abs(curW - lastW) > 30 || Math.abs(curH - lastH) > 30;

      const dw = window.outerWidth - window.innerWidth;
      const dh = window.outerHeight - window.innerHeight;

      if (viewportChanged) {
        // rotate / keyboard → reset baseline, ไม่ trigger
        lastW = curW;
        lastH = curH;
        clear();
        return;
      }

      // viewport เดิม แต่ outer-inner ต่างเยอะ → devtools เปิด
      if (dw > 250 || dh > 250) trigger();
      else clear();
    }, 500);
  }

  // debugger timing — desktop only
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  function watchDebugger() {
    if (isMobile) return;
    setInterval(() => {
      const t0 = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      if (performance.now() - t0 > 250) trigger();
    }, 4000);
  }

  function blockIframe() {
    if (window.top === window.self) return;
    try {
      window.top.location = window.self.location;
    } catch (_) {
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;' +
        "min-height:100vh;background:#08090a;color:#fb7185;" +
        'font-family:system-ui;text-align:center;padding:20px;">' +
        "<h1>Access Denied</h1></div>";
    }
  }

  function lockStorage() {
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (!ALLOWED_KEYS.includes(key)) return;
      originalSet.call(this, key, value);
    };
  }

  function init() {
    blockKeys();
    blockMouse();
    blockIframe();
    lockStorage();
    watchDebugger();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", () => {
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      clear();
    });
  }

  return { init, trigger, clear };
})();

Guard.init();
