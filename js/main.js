(function () {
  "use strict";

  var Auth = window.GetkeyAuth;
  var HWID = window.GetkeyHWID;
  var Time = window.GetkeyTime;

  var $ = function (id) { return document.getElementById(id); };

  var loginBox = $("loginBox");
  var contentBox = $("contentBox");
  var countdownEl = $("countdown");
  var timerEl = $("timer");
  var btn = $("getkeyBtn");
  var btnText = $("btnText");
  var btnIcon = $("btnIcon");
  var btnSpinner = $("btnSpinner");
  var discordBtn = $("discordBtn");
  var logoutBtn = $("logoutBtn");
  var userName = $("userName");
  var userTag = $("userTag");
  var userAvatar = $("userAvatar");
  var keyDisplay = $("keyDisplay");
  var keyStatus = $("keyStatus");
  var keyMeta = $("keyMeta");
  var metaType = $("metaType");
  var metaExpires = $("metaExpires");
  var metaHwid = $("metaHwid");
  var copyBtn = $("copyBtn");

  var currentKey = null;
  var timer = null;
  var banTimer = null;
  var banExpiresAt = null;
  var banCheckIv = null;

  var gate = {
    step1Token: null,
    step1Url: null,
    step2Url: null,
    stage: "idle"
  };

  var GATE_KEY = "gk.gate.v1";
  var GATE_TTL = 10 * 60 * 1000;

  function setLoading(on) {
    btnIcon.style.display = on ? "none" : "inline-flex";
    btnSpinner.style.display = on ? "inline-flex" : "none";
  }

  function paintUser(user) {
    userName.textContent = user.username || "-";
    userTag.textContent = user.discriminator && user.discriminator !== "0"
      ? "#" + user.discriminator
      : (user.global_name ? "@" + user.global_name : "");
    userAvatar.style.background = user.avatarColor || "#5865f2";
    userAvatar.textContent = (user.username || "?").charAt(0).toUpperCase();
  }

  function paintKey(key, meta) {
    currentKey = key;

    if (key) {
      keyDisplay.innerHTML = '<span class="key-text">' + key + "</span>";
      keyDisplay.classList.add("issued");
      copyBtn.disabled = false;
      keyStatus.textContent = "Issued";
      keyStatus.className = "key-card-status ready";

      if (meta) {
        keyMeta.style.display = "flex";
        metaType.textContent = meta.type || "-";
        metaExpires.textContent = meta.expireAt
          ? new Date(meta.expireAt).toLocaleString("en-US")
          : "-";
        metaHwid.textContent = HWID.get();
      }
    } else {
      keyDisplay.innerHTML = '<span class="key-placeholder">XXXX-XXXX-XXXX-XXXX</span>';
      keyDisplay.classList.remove("issued");
      copyBtn.disabled = true;
      keyStatus.textContent = "Ready";
      keyStatus.className = "key-card-status ready";
      keyMeta.style.display = "none";
    }
  }

  function paintLocked() {
    keyStatus.textContent = "Locked";
    keyStatus.className = "key-card-status locked";
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
    countdownEl.style.display = "none";
    btn.disabled = false;
    btnText.textContent = "Get key";
    setLoading(false);
  }

  function runTimer(unlockAt) {
    countdownEl.style.display = "flex";
    btn.disabled = true;
    btnText.textContent = "Locked";

    if (timer) clearInterval(timer);

    function tick() {
      var left = unlockAt - Date.now();
      if (left <= 0) {
        stopTimer();
        paintKey(null);
        return;
      }
      timerEl.textContent = Time.format(left);
    }

    tick();
    timer = setInterval(tick, 1000);
  }

  function saveGateState() {
    try {
      localStorage.setItem(GATE_KEY, JSON.stringify({
        step1Token: gate.step1Token,
        step1Url: gate.step1Url,
        step2Url: gate.step2Url,
        stage: gate.stage,
        startedAt: Date.now()
      }));
    } catch (e) {}
  }

  function restoreGateState() {
    try {
      var raw = localStorage.getItem(GATE_KEY);
      if (!raw) return false;

      var s = JSON.parse(raw);
      if (!s || !s.step1Token) return false;

      if (Date.now() - (s.startedAt || 0) > GATE_TTL) {
        localStorage.removeItem(GATE_KEY);
        return false;
      }

      gate.step1Token = s.step1Token;
      gate.step1Url = s.step1Url;
      gate.step2Url = s.step2Url;
      gate.stage = s.stage || "step1";
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearGateState() {
    try {
      localStorage.removeItem(GATE_KEY);
    } catch (e) {}
  }

  function formatBanTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var hh = String(Math.floor(s / 3600)).padStart(2, "0");
    var mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    var ss = String(s % 60).padStart(2, "0");
    return hh + ":" + mm + ":" + ss;
  }

  function showBanModal(banInfo) {
    return new Promise(function (resolve) {
      var expiresAt = banInfo.expiresAt || (Date.now() + 60 * 60 * 1000);

      if (banExpiresAt && expiresAt <= banExpiresAt) {
        var existingTimer = document.getElementById("banTimer");
        if (existingTimer) {
          existingTimer.textContent = formatBanTime(Math.max(0, banExpiresAt - Date.now()));
        }
        resolve();
        return;
      }

      var existing = document.getElementById("banModal");
      if (existing) existing.remove();

      if (banTimer) clearInterval(banTimer);
      banExpiresAt = expiresAt;

      var overlay = document.createElement("div");
      overlay.id = "banModal";
      overlay.className = "gate-modal-overlay";

      overlay.innerHTML =
        '<div class="gate-modal ban-modal">' +
        '  <div class="gate-modal-header">' +
        '    <div class="gate-modal-icon ban-icon">' +
        '      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '        <circle cx="12" cy="12" r="10"/>' +
        '        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>' +
        '      </svg>' +
        '    </div>' +
        '    <div class="gate-modal-title ban-title">Access Blocked</div>' +
        '    <div class="gate-modal-step ban-reason">IP temporarily banned</div>' +
        '  </div>' +
        '  <div class="gate-modal-body">' +
        '    <p>Your IP has been temporarily blocked because the verification steps were not completed properly.</p>' +
        '    <div class="ban-counter">' +
        '      <div class="ban-counter-label">Unban in</div>' +
        '      <div class="ban-counter-value" id="banTimer">--:--:--</div>' +
        '    </div>' +
        '    <div class="gate-modal-note ban-note">' +
        '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '        <circle cx="12" cy="12" r="10"/>' +
        '        <path d="M12 16v-4M12 8h.01"/>' +
        '      </svg>' +
        '      <span>Do not close the sponsor page early. Complete both steps fully before coming back.</span>' +
        '    </div>' +
        '  </div>' +
        '  <div class="gate-modal-actions">' +
        '    <button type="button" class="gate-btn gate-btn-primary" data-action="close" style="flex:1;">' +
        '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '        <path d="M20 6L9 17l-5-5"/>' +
        '      </svg>' +
        '      <span>Understood</span>' +
        '    </button>' +
        '  </div>' +
        '</div>';

      document.body.appendChild(overlay);

      requestAnimationFrame(function () {
        overlay.classList.add("show");
      });

      var timerEl = overlay.querySelector("#banTimer");
      timerEl.textContent = formatBanTime(Math.max(0, expiresAt - Date.now()));

      banTimer = setInterval(function () {
        var left = banExpiresAt - Date.now();
        if (left <= 0) {
          clearInterval(banTimer);
          banTimer = null;
          banExpiresAt = null;
          timerEl.textContent = "00:00:00";
          return;
        }
        timerEl.textContent = formatBanTime(left);
      }, 1000);

      function close() {
        overlay.style.pointerEvents = "none";
        overlay.classList.remove("show");
        setTimeout(function () {
          overlay.remove();
          resolve();
        }, 200);
      }

      overlay.addEventListener("click", function (e) {
        var action = e.target.closest("[data-action]");
        if (action) close();
      });

      document.addEventListener("keydown", function esc(e) {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", esc);
          close();
        }
      });
    });
  }

  function startBanPolling() {
    if (banCheckIv) return;

    banCheckIv = setInterval(function () {
      if (!Auth.isLoggedIn()) return;

      fetch("/api/key/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: Auth.getSession() })
      }).then(function (res) {
        if (res.status !== 403) return null;
        return res.json();
      }).then(function (data) {
        if (data && data.banned && data.expiresAt) {
          showBanModal({
            reason: data.reason,
            expiresAt: data.expiresAt
          });
        }
      }).catch(function () {});
    }, 30000);
  }

  async function loadStatus() {
    var session = Auth.getSession();
    if (!session) return;

    keyStatus.textContent = "Loading";
    keyStatus.className = "key-card-status";

    try {
      var res = await fetch("/api/key/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: session })
      });

      if (res.status === 403) {
        var bdata = await res.json().catch(function () { return {}; });
        if (bdata.banned) {
          showBanModal({
            reason: bdata.reason,
            expiresAt: bdata.expiresAt
          });
        }
        paintKey(null);
        stopTimer();
        return;
      }

      var data = await res.json();

      if (data.locked) {
        paintLocked();
        runTimer(data.unlockAt);
      } else {
        paintKey(null);
        stopTimer();
      }
    } catch (e) {
      paintKey(null);
    }
  }

  function showLoggedIn() {
    var user = Auth.getUser();
    if (!user) return showLoggedOut();
    paintUser(user);
    loginBox.style.display = "none";
    contentBox.style.display = "block";
    loadStatus();
    startBanPolling();
  }

  function showLoggedOut() {
    loginBox.style.display = "block";
    contentBox.style.display = "none";
  }

  function openExternal(url) {
    if (!url) return;
    if (document.getElementById("gateModal")) return;
    window.location.href = url;
  }

  function showGateModal(opts) {
    return new Promise(function (resolve) {
      var existing = document.getElementById("gateModal");
      if (existing) existing.remove();

      var overlay = document.createElement("div");
      overlay.id = "gateModal";
      overlay.className = "gate-modal-overlay";

      overlay.innerHTML =
        '<div class="gate-modal">' +
        '  <div class="gate-modal-header">' +
        '    <div class="gate-modal-icon">' +
        '      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
        '        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
        '      </svg>' +
        '    </div>' +
        '    <div class="gate-modal-title">' + opts.title + '</div>' +
        '    <div class="gate-modal-step">Step ' + opts.step + ' of ' + opts.total + '</div>' +
        '  </div>' +
        '  <div class="gate-modal-body">' +
        '    <p>' + opts.description + '</p>' +
        '    <div class="gate-modal-note">' +
        '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '        <circle cx="12" cy="12" r="10"/>' +
        '        <path d="M12 16v-4M12 8h.01"/>' +
        '      </svg>' +
        '      <span>' + opts.note + '</span>' +
        '    </div>' +
        '  </div>' +
        '  <div class="gate-modal-actions">' +
        '    <button type="button" class="gate-btn gate-btn-ghost" data-action="cancel">Cancel</button>' +
        '    <button type="button" class="gate-btn gate-btn-primary" data-action="confirm">' +
        '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
        '        <polyline points="15 3 21 3 21 9"/>' +
        '        <line x1="10" y1="14" x2="21" y2="3"/>' +
        '      </svg>' +
        '      <span>' + opts.confirmText + '</span>' +
        '    </button>' +
        '  </div>' +
        '</div>';

      document.body.appendChild(overlay);

      requestAnimationFrame(function () {
        overlay.classList.add("show");
      });

      function close(result) {
        overlay.style.pointerEvents = "none";
        overlay.classList.remove("show");
        setTimeout(function () {
          overlay.remove();
          resolve(result);
        }, 200);
      }

      overlay.addEventListener("click", function (e) {
        var action = e.target.closest("[data-action]");
        if (!action) {
          if (e.target === overlay) close(false);
          return;
        }
        close(action.dataset.action === "confirm");
      });

      document.addEventListener("keydown", function esc(e) {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", esc);
          close(false);
        }
      });
    });
  }

  function startGate() {
    var hwid = HWID.get();
    var session = Auth.getSession();

    return fetch("/api/key/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session: session,
        hwid: hwid,
        type: "1day"
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          if (res.status === 403 && (data.banned || data.reason)) {
            showBanModal({
              reason: data.reason || "policy_violation",
              expiresAt: data.expiresAt || (Date.now() + 60 * 60 * 1000)
            });
            var err = new Error("Banned");
            err.__banned = true;
            throw err;
          }
          throw new Error(data.error || "Failed to start (HTTP " + res.status + ")");
        }

        if (!data.linkvertiseStep1 || !data.linkvertiseStep2) {
          throw new Error("Gate is not configured");
        }

        gate.step1Token = data.step1Token;
        gate.step1Url = data.linkvertiseStep1;
        gate.step2Url = data.linkvertiseStep2;
        gate.stage = "step1";
        saveGateState();
        return data;
      });
    });
  }

  function completeGate() {
    var hwid = HWID.get();

    return fetch("/api/key/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step1Token: gate.step1Token,
        hwid: hwid
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          if (res.status === 403 && (data.banned || data.reason)) {
            showBanModal({
              reason: data.reason || "policy_violation",
              expiresAt: data.expiresAt || (Date.now() + 60 * 60 * 1000)
            });
            var err = new Error("Banned");
            err.__banned = true;
            throw err;
          }
          throw new Error(data.error || "Failed to complete");
        }
        return data;
      });
    });
  }

  function step1Flow() {
    if (btn.dataset.gateStage === "step1" || btn.dataset.gateStage === "step2") {
      return;
    }

    if (!gate.step1Url) {
      alert("Step 1 link is not configured");
      stopTimer();
      return;
    }

    showGateModal({
      title: "Open Sponsor Link",
      step: 1,
      total: 2,
      description: "Click continue below. The sponsor page will open. Wait for it to fully load, then come back here.",
      note: "Closing the sponsor page early may break the verification.",
      confirmText: "Open link"
    }).then(function (ok) {
      if (!ok) {
        stopTimer();
        return;
      }

      gate.stage = "step1";
      saveGateState();

      btn.dataset.gateStage = "step1";
      btnText.textContent = "I finished step 1";

      var onStep1Done = function () {
        btn.removeEventListener("click", onStep1Done);
        step2Flow();
      };

      btn.addEventListener("click", onStep1Done);

      openExternal(gate.step1Url);
    });
  }

  function step2Flow() {
    if (btn.dataset.gateStage === "step2") {
      return;
    }

    if (!gate.step2Url) {
      alert("Step 2 link is not configured");
      stopTimer();
      return;
    }

    btnText.textContent = "Step 2...";
    setLoading(true);

    setTimeout(function () {
      setLoading(false);

      showGateModal({
        title: "Final Step",
        step: 2,
        total: 2,
        description: "Click continue below. The second sponsor page will open. Wait for it to fully load, then come back.",
        note: "After this step your key will be issued automatically.",
        confirmText: "Open link"
      }).then(function (ok) {
        if (!ok) {
          stopTimer();
          return;
        }

        gate.stage = "step2";
        saveGateState();

        btn.dataset.gateStage = "step2";
        btn.disabled = true;
        btnText.textContent = "Claiming key...";
        setLoading(true);

        setTimeout(function () {
          openExternal(gate.step2Url);
        }, 150);
      });
    }, 700);
  }

  function resumeGate() {
    if (!restoreGateState()) return false;

    if (gate.stage === "step1") {
      btn.dataset.gateStage = "step1";
      btnText.textContent = "I finished step 1";

      var onStep1Done = function () {
        btn.removeEventListener("click", onStep1Done);
        step2Flow();
      };

      btn.addEventListener("click", onStep1Done);

      return true;
    }

    return false;
  }

  function handleGateQuery() {
    var params = new URLSearchParams(window.location.search);
    var gateStage = params.get("gate");

    if (!gateStage) return false;

    try {
      var cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    } catch (e) {}

    if (gateStage === "step1") {
      if (!restoreGateState()) {
        return false;
      }

      gate.stage = "step1";
      saveGateState();

      btn.dataset.gateStage = "step1";
      btnText.textContent = "I finished step 1";
      setLoading(false);

      var onStep1Done = function () {
        btn.removeEventListener("click", onStep1Done);
        step2Flow();
      };

      btn.addEventListener("click", onStep1Done);

      return true;
    }

    if (gateStage === "step2") {
      if (!restoreGateState()) {
        fetch("/api/key/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step1Token: "invalid", hwid: HWID.get() })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (d && d.banned) {
            showBanModal({
              reason: d.reason,
              expiresAt: d.expiresAt
            });
          }
        }).catch(function () {});
        return true;
      }

      gate.stage = "step2";
      saveGateState();

      btn.dataset.gateStage = "step2";
      btn.disabled = true;
      btnText.textContent = "Claiming key...";
      setLoading(true);

      setTimeout(function () {
        completeGate().then(function (data) {
          clearGateState();
          delete btn.dataset.gateStage;
          paintKey(data.key, data);
          runTimer(data.cooldownUntil);
        }).catch(function (err) {
          clearGateState();
          delete btn.dataset.gateStage;
          if (err && err.__banned) {
            btnText.textContent = "Get key";
            setLoading(false);
            return;
          }
          alert(err.message || "Failed to claim key");
          stopTimer();
        });
      }, 1200);

      return true;
    }

    return false;
  }

  document.querySelectorAll(".method-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".method-btn").forEach(function (x) {
        x.classList.remove("active");
      });
      b.classList.add("active");
    });
  });

  discordBtn.addEventListener("click", function () {
    Auth.login();
  });

  logoutBtn.addEventListener("click", function () {
    Auth.logout();
    clearGateState();
    stopTimer();
    showLoggedOut();
  });

  copyBtn.addEventListener("click", async function () {
    if (!currentKey) return;
    try {
      await navigator.clipboard.writeText(currentKey);
      copyBtn.classList.add("copied");
      var span = copyBtn.querySelector("span");
      var original = span.textContent;
      span.textContent = "Copied!";
      setTimeout(function () {
        copyBtn.classList.remove("copied");
        span.textContent = original;
      }, 1500);
    } catch (e) {}
  });

  btn.addEventListener("click", function () {
    if (btn.dataset.gateStage === "step1" || btn.dataset.gateStage === "step2") {
      return;
    }

    if (!Auth.isLoggedIn()) {
      alert("Please login with Discord first");
      return;
    }

    btn.disabled = true;
    btnText.textContent = "Starting gate...";
    setLoading(true);

    startGate().then(function () {
      setLoading(false);
      step1Flow();
    }).catch(function (err) {
      setLoading(false);
      btn.disabled = false;
      btnText.textContent = "Get key";
      if (err && err.__banned) return;
      alert(err.message || "Network error");
    });
  });

  if (Auth.isLoggedIn()) {
    showLoggedIn();
    var handled = handleGateQuery();
    if (!handled) {
      resumeGate();
    }
  } else {
    showLoggedOut();
  }
})();
