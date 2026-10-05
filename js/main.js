(function () {
  "use strict";

  const Auth = window.GetkeyAuth;
  const CD   = window.GetkeyCooldown;

  const loginBox    = document.getElementById("loginBox");
  const contentBox  = document.getElementById("contentBox");
  const countdownEl = document.getElementById("countdown");
  const timerEl     = document.getElementById("timer");
  const btn         = document.getElementById("getkeyBtn");
  const btnText     = document.getElementById("btnText");
  const discordBtn  = document.getElementById("discordBtn");
  const logoutBtn   = document.getElementById("logoutBtn");
  const userName    = document.getElementById("userName");
  const userTag     = document.getElementById("userTag");
  const userAvatar  = document.getElementById("userAvatar");

  let selectedType = "1day";
  let timerInterval = null;

  function applyDiscordUser(user) {
    userName.textContent = user.username || "-";
    userTag.textContent  = user.discriminator && user.discriminator !== "0"
      ? "#" + user.discriminator
      : (user.global_name ? "@" + user.global_name : "");
    userAvatar.style.background = user.avatarColor || "#5865f2";
    userAvatar.textContent = (user.username || "?").charAt(0).toUpperCase();
  }

  function showLoggedIn() {
    const user = Auth.getUser();
    if (!user) return showLoggedOut();
    applyDiscordUser(user);
    loginBox.style.display = "none";
    contentBox.style.display = "block";
    initCooldown();
  }

  function showLoggedOut() {
    loginBox.style.display = "block";
    contentBox.style.display = "none";
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
        CD.cleanExpired();
        countdownEl.style.display = "none";
        btn.disabled = false;
        btnText.textContent = "Get key";
        return;
      }
      timerEl.textContent = CD.formatTime(remain);
    }
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function initCooldown() {
    CD.cleanExpired();
    const unlockAt = CD.getUnlockAt();
    if (unlockAt > Date.now()) {
      startCountdownUI(unlockAt);
    } else {
      countdownEl.style.display = "none";
      btn.disabled = false;
      btnText.textContent = "Get key";
    }
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
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    showLoggedOut();
  });

  btn.addEventListener("click", function () {
    if (!Auth.isLoggedIn()) {
      alert("กรุณาเข้าสู่ระบบด้วย Discord ก่อน");
      return;
    }
    CD.cleanExpired();
    if (CD.isLocked()) {
      alert("คุณยังอยู่ในช่วงคูลดาวน์ กรุณารอให้ครบก่อน");
      return;
    }

    const user = Auth.getUser();
    const result = CD.issueKey(selectedType, {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator
    });

    alert(
      "รับคีย์สำเร็จ\n\n" +
      "คีย์: " + result.key + "\n" +
      "ประเภท: " + selectedType + "\n" +
      "HWID: " + result.hwid + "\n" +
      "ผู้ใช้: " + user.username
    );

    startCountdownUI(result.until);
  });

  if (Auth.isLoggedIn()) {
    showLoggedIn();
  } else {
    showLoggedOut();
  }
})();