(function () {
  "use strict";

  var C = window.GETKEY_CONFIG;

  var Auth = {
    buildLoginURL: function () {
      var state = Math.random().toString(36).slice(2) +
                  Math.random().toString(36).slice(2);
      sessionStorage.setItem(C.KEY_OAUTH_STATE, state);

      var params = new URLSearchParams({
        client_id: C.DISCORD_CLIENT_ID,
        redirect_uri: C.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: C.DISCORD_OAUTH_SCOPE,
        state: state,
        prompt: "consent"
      });

      return "https://discord.com/oauth2/authorize?" + params.toString();
    },

    login: function () {
      window.location.href = this.buildLoginURL();
    },

    logout: function () {
      localStorage.removeItem(C.KEY_SESSION);
      localStorage.removeItem(C.KEY_DISCORD);
    },

    getSession: function () {
      return localStorage.getItem(C.KEY_SESSION) || "";
    },

    getUser: function () {
      var raw = localStorage.getItem(C.KEY_DISCORD);
      if (!raw) return null;
      try {
        var u = JSON.parse(raw);
        return u && u.id ? u : null;
      } catch (e) {
        return null;
      }
    },

    isLoggedIn: function () {
      return !!this.getUser() && !!this.getSession();
    },

    exchangeCode: async function (code) {
      var res = await fetch("/api/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code,
          redirect_uri: C.DISCORD_REDIRECT_URI
        })
      });

      var data = await res.json().catch(function () { return {}; });

      if (!res.ok) {
        throw new Error(data.error || "Exchange failed: " + res.status);
      }

      if (!data.session || !data.user || !data.user.id) {
        throw new Error("Invalid response from server");
      }

      return data;
    },

    saveSession: function (data) {
      localStorage.setItem(C.KEY_SESSION, data.session);
      localStorage.setItem(C.KEY_DISCORD, JSON.stringify(data.user));
    }
  };

  window.GetkeyAuth = Auth;
})();
