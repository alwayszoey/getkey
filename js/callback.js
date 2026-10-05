(function () {
  "use strict";

  var C = window.GETKEY_CONFIG;
  var Auth = window.GetkeyAuth;

  async function run() {
    var params = new URLSearchParams(window.location.search);
    var code = params.get("code");
    var state = params.get("state");
    var error = params.get("error");

    if (error || !code) {
      window.location.href = "/";
      return;
    }

    var saved = sessionStorage.getItem(C.KEY_OAUTH_STATE);
    if (!saved || saved !== state) {
      window.location.href = "/";
      return;
    }
    sessionStorage.removeItem(C.KEY_OAUTH_STATE);

    try {
      var data = await Auth.exchangeCode(code);
      Auth.saveSession(data);
      window.location.href = "/";
    } catch (e) {
      alert("Login failed: " + e.message);
      window.location.href = "/";
    }
  }

  run();
})();
