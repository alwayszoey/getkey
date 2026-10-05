(function () {
  "use strict";

  const C = window.GETKEY_CONFIG;
  const Auth = window.GetkeyAuth;

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      alert("ล็อกอินถูกยกเลิก: " + error);
      window.location.href = "index.html";
      return;
    }
    if (!code) {
      alert("ไม่พบ code จาก Discord");
      window.location.href = "index.html";
      return;
    }

    const savedState = sessionStorage.getItem(C.KEY_OAUTH_STATE);
    if (!savedState || savedState !== state) {
      alert("State ไม่ตรง กรุณาล็อกอินใหม่");
      window.location.href = "index.html";
      return;
    }
    sessionStorage.removeItem(C.KEY_OAUTH_STATE);

    try {
      const user = await Auth.exchangeCode(code);
      if (!user) throw new Error("ไม่สามารถดึงข้อมูล user ได้");
      Auth.saveUser(user);
      window.location.href = "index.html";
    } catch (e) {
      alert("ล็อกอินไม่สำเร็จ: " + e.message);
      window.location.href = "index.html";
    }
  }

  handleCallback();
})();