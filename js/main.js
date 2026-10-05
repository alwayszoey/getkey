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

  btn.addEventListener("click", async function () {
    if (!Auth.isLoggedIn()) {
      alert("Please login with Discord first");
      return;
    }

    var session = Auth.getSession();
    var hwid = HWID.get();

    btn.disabled = true;
    btnText.textContent = "Requesting...";
    setLoading(true);

    try {
      var res = await fetch("/api/key/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, hwid, type: "1day" })
      });

      var data = await res.json();
      setLoading(false);

      if (!res.ok) {
        if (res.status === 429 && data.unlockAt) {
          runTimer(data.unlockAt);
          return;
        }
        alert(data.error || "Failed to issue key");
        btn.disabled = false;
        btnText.textContent = "Get key";
        return;
      }

      paintKey(data.key, data);
      runTimer(data.cooldownUntil);
    } catch (e) {
      setLoading(false);
      alert("Network error");
      btn.disabled = false;
      btnText.textContent = "Get key";
    }
  });

  if (Auth.isLoggedIn()) showLoggedIn();
  else showLoggedOut();
})();
