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
  var gate = {
    step1Token: null,
    step1Url: null,
    step2Url: null,
    stage: "idle"
  };

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

  async function loadStatus() {
    var session = Auth.getSession();
    if (!session) return;

    keyStatus.textContent = "Loading";
    keyStatus.className = "key-card-status";

    try {
      var res = await fetch("/api/key/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session })
      });

      if (res.status === 403) {
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
  }

  function showLoggedOut() {
    loginBox.style.display = "block";
    contentBox.style.display = "none";
  }

  function openExternal(url) {
    if (!url) return;
    try {
      var w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        var a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {}
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
          if (res.status === 403 && data.reason) {
            throw new Error("Banned: " + data.reason);
          }
          throw new Error(data.error || "Failed to start");
        }
        gate.step1Token = data.step1Token;
        gate.step1Url = data.linkvertiseStep1;
        gate.step2Url = data.linkvertiseStep2;
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
          if (res.status === 403 && data.reason) {
            throw new Error("Banned: " + data.reason);
          }
          throw new Error(data.error || "Failed to complete");
        }
        return data;
      });
    });
  }

  function step1Flow() {
    if (!gate.step1Url) {
      alert("Step 1 link is not configured");
      stopTimer();
      return;
    }

    var proceed = confirm(
      "Step 1 of 2\n\n" +
      "Open the sponsor link, wait for it to fully load, then come back.\n\n" +
      "Click OK to open the link."
    );

    if (!proceed) {
      stopTimer();
      return;
    }

    openExternal(gate.step1Url);

    btnText.textContent = "I finished step 1";

    var onStep1Done = function () {
      btn.removeEventListener("click", onStep1Done);
      step2Flow();
    };

    btn.addEventListener("click", onStep1Done);
  }

  function step2Flow() {
    if (!gate.step2Url) {
      alert("Step 2 link is not configured");
      stopTimer();
      return;
    }

    btnText.textContent = "Step 2...";
    setLoading(true);

    setTimeout(function () {
      setLoading(false);
      var proceed = confirm(
        "Step 2 of 2\n\n" +
        "Open the second sponsor link, wait for it to fully load, then come back.\n\n" +
        "Click OK to open the link."
      );

      if (!proceed) {
        stopTimer();
        return;
      }

      openExternal(gate.step2Url);
      btn.disabled = true;
      btnText.textContent = "Claiming key...";
      setLoading(true);

      setTimeout(function () {
        completeGate().then(function (data) {
          paintKey(data.key, data);
          runTimer(data.cooldownUntil);
        }).catch(function (err) {
          alert(err.message || "Failed to claim key");
          stopTimer();
        });
      }, 6000);
    }, 700);
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
      alert(err.message || "Network error");
      btn.disabled = false;
      btnText.textContent = "Get key";
    });
  });

  if (Auth.isLoggedIn()) showLoggedIn();
  else showLoggedOut();
})();
