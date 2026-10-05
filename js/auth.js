(function () {
  "use strict";

  const C = window.GETKEY_CONFIG;

  const Auth = {
    buildLoginURL() {
      const state = Math.random().toString(36).slice(2) +
                    Math.random().toString(36).slice(2);
      sessionStorage.setItem(C.KEY_OAUTH_STATE, state);

      const params = new URLSearchParams({
        client_id: C.DISCORD_CLIENT_ID,
        redirect_uri: C.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: C.DISCORD_OAUTH_SCOPE,
        state: state,
        prompt: "consent"
      });

      return "https://discord.com/oauth2/authorize?" + params.toString();
    },

    login() {
      window.location.href = this.buildLoginURL();
    },

    logout() {
      localStorage.removeItem(C.KEY_DISCORD);
      localStorage.removeItem(C.KEY_ACCESS_TOKEN);
    },

    getUser() {
      const raw = localStorage.getItem(C.KEY_DISCORD);
      if (!raw) return null;
      try {
        const u = JSON.parse(raw);
        return u && u.id ? u : null;
      } catch (e) {
        return null;
      }
    },

    isLoggedIn() {
      return !!this.getUser();
    },

    async exchangeCode(code) {
      const res = await fetch("/api/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code,
          redirect_uri: C.DISCORD_REDIRECT_URI
        })
      });

      const data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok) {
        throw new Error(data.error || "Exchange failed: " + res.status);
      }

      if (!data.user || !data.user.id) {
        throw new Error("Invalid user data from server");
      }

      return data.user;
    },

    saveUser(user) {
      localStorage.setItem(C.KEY_DISCORD, JSON.stringify(user));
    }
  };

  window.GetkeyAuth = Auth;
})();
