(function () {
  "use strict";

  const state = {
    triggered: false,
    overlay: null,
    originalTitle: document.title,
    watchdog: null
  };

  const config = {
    sizeThreshold: 160,
    checkInterval: 700,
    debuggerInterval: 1200,
    probeInterval: 1000,
    allowedStorageKeys: [
      "getkey_cooldown_until",
      "getkey_hwid",
      "getkey_key",
      "getkey_discord_user",
      "getkey_oauth_state",
      "getkey_access_token"
    ]
  };

  const overlayStyles = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #08090a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: system-ui, -apple-system, sans-serif;
    text-align: center;
    color: #fafafa;
    animation: guardFade .2s ease;
  `;

  const overlayMarkup = `
    <div style="max-width:420px">
      <div style="font-size:56px;margin-bottom:20px;animation:guardPulse 1s ease infinite">🚫</div>
      <div style="font-size:22px;font-weight:800;color:#f87171;margin-bottom:12px;letter-spacing:-0.02em">
        Close DevTools to continue
      </div>
      <div style="font-size:14px;color:#a1a1aa;line-height:1.7;margin-bottom:20px">
        This page requires DevTools to be closed.<br>Reload after closing it.
      </div>
      <div style="font-size:11px;color:#52525b;padding:8px 14px;background:#18181b;border:1px solid #27272a;border-radius:8px;display:inline-block;font-family:monospace">
        Press F5 or reopen the tab
      </div>
    </div>
  `;

  const overlayCSS = `
    @keyframes guardFade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes guardPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.08) } }
  `;

  function injectStyles() {
    if (document.getElementById("__guard_styles")) return;
    const tag = document.createElement("style");
    tag.id = "__guard_styles";
    tag.textContent = overlayCSS;
    document.head.appendChild(tag);
  }

  function showOverlay() {
    if (state.overlay) return;
    injectStyles();

    const el = document.createElement("div");
    el.id = "__guard_overlay";
    el.style.cssText = overlayStyles;
    el.innerHTML = overlayMarkup;

    document.body.appendChild(el);
    state.overlay = el;
    document.title = "\u26D4 SECURITY";

    if (document.body) {
      document.body.style.overflow = "hidden";
    }
  }

  function hideOverlay() {
    if (state.overlay && state.overlay.parentNode) {
      state.overlay.parentNode.removeChild(state.overlay);
    }
    state.overlay = null;
    document.title = state.originalTitle;

    if (document.body) {
      document.body.style.overflow = "";
    }
  }

  function trip() {
    if (state.triggered) return;
    state.triggered = true;
    showOverlay();
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch (e) {}
  }

  function untrip() {
    if (!state.triggered) return;
    state.triggered = false;
    hideOverlay();
  }

  function detectWindowSize() {
    const dw = window.outerWidth - window.innerWidth;
    const dh = window.outerHeight - window.innerHeight;
    return dw > config.sizeThreshold || dh > config.sizeThreshold;
  }

  function detectDebuggerTiming() {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const end = performance.now();
    return end - start > 100;
  }

  function startSizeWatcher() {
    const check = function () {
      if (detectWindowSize()) trip();
      else untrip();
    };
    setInterval(check, config.checkInterval);
    window.addEventListener("resize", check);
  }

  function startDebuggerWatcher() {
    setInterval(function () {
      if (detectDebuggerTiming()) trip();
    }, config.debuggerInterval);
  }

  function startConsoleProbe() {
    const probe = /./;
    probe.toString = function () {
      trip();
      return "";
    };

    setInterval(function () {
      try {
        // eslint-disable-next-line no-console
        console.log(probe);
      } catch (e) {}
    }, config.probeInterval);
  }

  function blockDevtoolsKeys() {
    document.addEventListener("keydown", function (event) {
      const key = (event.key || "").toUpperCase();

      if (event.key === "F12" || event.keyCode === 123) {
        event.preventDefault();
        return false;
      }

      if (event.ctrlKey && event.shiftKey && ["I", "J", "C"].includes(key)) {
        event.preventDefault();
        return false;
      }

      if (event.metaKey && event.altKey && ["I", "J", "C"].includes(key)) {
        event.preventDefault();
        return false;
      }

      if ((event.ctrlKey || event.metaKey) && ["U", "S"].includes(key)) {
        event.preventDefault();
        return false;
      }
    }, true);
  }

  function blockContextMenu() {
    document.addEventListener("contextmenu", function (event) {
      event.preventDefault();
      return false;
    }, true);
  }

  function blockSelection() {
    document.addEventListener("selectstart", function (event) {
      event.preventDefault();
    }, true);
    document.addEventListener("dragstart", function (event) {
      event.preventDefault();
    }, true);
  }

  function lockStorage() {
    try {
      const original = Storage.prototype.setItem;
      const allowed = config.allowedStorageKeys;
      Storage.prototype.setItem = function (key, value) {
        if (allowed.indexOf(key) === -1) return;
        return original.call(this, key, value);
      };
    } catch (e) {}
  }

  function blockIframe() {
    if (window.top !== window.self) {
      try {
        window.top.location = window.self.location;
      } catch (e) {
        document.body.innerHTML = "<h1>Access Denied</h1>";
      }
    }
  }

  function freezeCoreApis() {
    try {
      Object.defineProperty(window, "GetkeyAuth", {
        configurable: false,
        writable: false
      });
      Object.defineProperty(window, "GetkeyCooldown", {
        configurable: false,
        writable: false
      });
    } catch (e) {}
  }

  function init() {
    blockDevtoolsKeys();
    blockContextMenu();
    blockSelection();
    blockIframe();
    lockStorage();
    startSizeWatcher();
    startDebuggerWatcher();
    startConsoleProbe();

    window.addEventListener("load", freezeCoreApis);
  }

  init();
})();
