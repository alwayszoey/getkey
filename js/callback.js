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
      alert("Login cancelled: " + error);
      window.location.href = "/";
      return;
    }

    if (!code) {
      alert("No code returned from Discord");
      window.location.href = "/";
      return;
    }

    const savedState = sessionStorage.getItem(C.KEY_OAUTH_STATE);
    if (!savedState || savedState !== state) {
      alert("Invalid state. Please login again.");
      window.location.href = "/";
      return;
    }
    sessionStorage.removeItem(C.KEY_OAUTH_STATE);

    try {
      const user = await Auth.exchangeCode(code);
      Auth.saveUser(user);
      window.location.href = "/";
    } catch (err) {
      alert("Login failed: " + err.message);
      window.location.href = "/";
    }
  }

  handleCallback();
})();
