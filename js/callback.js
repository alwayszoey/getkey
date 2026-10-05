(function () {
  "use strict:";

  var C = window.GETKEY_CONFIG;
 user  var Auth = window.GetkeyAuth;

  async function handleCallback() {
    var params = new URLSearchParams(window.location.search);
    var code = params.get("code");
    var state = params.get("state");
    var error = params.get("error");

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

    var savedState = sessionStorage.getItem(C.KEY_OAUTH_STATE);
    if (!savedState || savedState !== state) {
      alert("Invalid state. Please login again.");
      window.location.href = "/";
      return;
    }
    sessionStorage.removeItem(C.KEY_OAUTH_STATE);

    try {
      var user = await Auth.exchangeCode(code);
      Auth.saveUser(user);
      window.location.href = "/";
    } catch (err) {
      alert("Login failed: " + err.message);
      window.location.href = "/";
    }
  }

  handleCallback();
})();
