(function () {
  "use strict";

  const Auth = window.GetkeyAuth;
  const CD = window.GetkeyCooldown;

  const loginBox = document.getElementById("loginBox");
  const contentBox = document.getElementById("contentBox");
  const countdownEl = document.getElementById("countdown");
  const timerEl = document.getElementById("timer");
  const btn = document.getElementById("getkeyBtn");
  const btnText = document.getElementById("btnText");
  const discordBtn = document.getElementById("discordBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userName = document.getElementById("userName");
  const userTag = document.getElementById("userTag");
  const userAvatar = document.getElementById("userAvatar");
  const keyDisplay = document.getElementById("keyDisplay");
  const keyStatus = document.getElementById("keyStatus");
  const keyMeta = document.getElementById("keyMeta");
  const metaType = document.getElementById("metaType");
  const metaExpires = document.getElementById("metaExpires");
  const metaHwid = document.getElementById("metaHwid");
  const copyBtn = document.getElementById("copyBtn");

  let selectedType = "1day";
  let timerInterval = null;
  let currentKey = null;

  function applyDiscordUser(user) {
    userName.textContent = user.username || "-";
    userTag.textContent =
      user.discriminator && user.discriminator !== "0"
        ? "#" + user.discriminator
        : user.global_name
        ? "@" + user.global_name
        : "";
    userAvatar.style.background = user.avatarColor || "#5865f2";
    userAvatar.textContent = (user.username || "?").charAt(0).toUpperCase();
  }

  function setKeyDisplay(key, meta) {
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
          ? new Date(meta.expireAt).toLocaleString("th-TH")
          : "-";
        metaHwid.textContent = meta.hwid || "-";
      }
    } else {
      keyDisplay.innerHTML =
        '<span class="key-placeholder">XXXX-XXXX-XXXX-XXXX</span>';
      keyDisplay.classList.remove("issued");
      copyBtn.disabled = true;
      keyStatus.textContent = "Ready";
      keyStatus.className = "key-card-status ready";
      keyMeta.style.display = "none";
    }
  }

  function setStatusLocked() {
    keyStatus.textContent = "Locked";
    keyStatus.className = "key-card-status locked";
  }

  function showLoggedIn() {
    const user = Auth.getUser();
    if (!user) return showLoggedOut();
    applyDiscordUser(user);
    loginBox.style.display = "none";
    contentBox.style.display = "block";
    checkRemoteStatus(user.id);
  }

  function showLoggedOut() {
    loginBox.style.display = "block";
    contentBox.style.display = "none";
  }

  async function checkRemoteStatus(discordId) {
    try {
      const res = await fetch(
        "/api/key/status?discordId=" + encodeURIComponent(discordId)
      );
      const data = await res.json();

      if (data.locked) {
        setKeyDisplay(data.key, { type: data.type, expireAt: data.unlockAt });
        setStatusLocked();
        startCountdownUI(data.unlockAt);
      } else {
        setKeyDisplay(null);
        stopCountdown();
      }
    } catch (e) {
      setKeyDisplay(null);
    }
  }

  function startCountdownUI(unlockAt) {
    countdownEl.style.display = "flex";
    btn.disabled = true;
    btnText.textContent = "Locked";

    if (timerInterval) clearInterval(timerInterval);

    function tick() {
      const remain = unlockAt - Date.now();
      if (remain <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        countdownEl.style.display = "none";
        btn.disabled = false;
        btnText.textContent = "Get key";
        setKeyDisplay(null);
        return;
      }
      timerEl.textContent = CD.formatTime(remain);
    }
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function stopCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    countdownEl.style.display = "none";
    btn.disabled = false;
    btnText.textContent = "Get key";
  }

  document.querySelectorAll(".method-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".method-btn").forEach(function (x) {
        x.classList.remove("active");
      });
      b.classList.add("active");
      selectedType = b.dataset.type;
    });
  });

  discordBtn.addEventListener("click", function () {
    Auth.login();
  });

  logoutBtn.addEventListener("click", function () {
    Auth.logout();
    stopCountdown();
    showLoggedOut();
  });

  copyBtn.addEventListener("click", async function () {
    if (!currentKey) return;
    try {
      await navigator.clipboard.writeText(currentKey);
      copyBtn.classList.add("copied");
      const span = copyBtn.querySelector("span");
      const original = span.textContent;
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

    const user = Auth.getUser();
    const hwid = CD.getHWID();

    btn.disabled = true;
    btnText.textContent = "Requesting...";

    try {
      const res = await fetch("/api/key/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: user.id,
          type: selectedType,
          hwid: hwid
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.unlockAt) {
          startCountdownUI(data.unlockAt);
          return;
        }
        alert(data.error || "Failed to issue key");
        btn.disabled = false;
        btnText.textContent = "Get key";
        return;
      }

      setKeyDisplay(data.key, data);
      startCountdownUI(data.cooldownUntil);
    } catch (e) {
      alert("Network error");
      btn.disabled = false;
      btnText.textContent = "Get key";
    }
  });

  if (Auth.isLoggedIn()) showLoggedIn();
  else showLoggedOut();
})();
