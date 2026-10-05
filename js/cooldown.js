(function () {
  "use strict";

  const C = window.GETKEY_CONFIG;

  const Cooldown = {
    getHWID() {
      let hwid = localStorage.getItem(C.KEY_HWID);
      if (!hwid) {
        hwid = this._generateHWID();
        localStorage.setItem(C.KEY_HWID, hwid);
      }
      return hwid;
    },

    _generateHWID() {
      const raw = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0
      ].join("|");

      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash = hash & hash;
      }
      return "HWID-" + Math.abs(hash).toString(36).toUpperCase();
    },

    getCooldownUntil() {
      const v = localStorage.getItem(C.KEY_COOLDOWN);
      return v ? parseInt(v, 10) : 0;
    },

    setCooldown(until) {
      localStorage.setItem(C.KEY_COOLDOWN, String(until));
    },

    clearCooldown() {
      localStorage.removeItem(C.KEY_COOLDOWN);
    },

    getKeyData() {
      const raw = localStorage.getItem(C.KEY_DATA);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    saveKeyData(data) {
      localStorage.setItem(C.KEY_DATA, JSON.stringify(data));
    },

    clearKeyData() {
      localStorage.removeItem(C.KEY_DATA);
    },

    getKeyExpireAt() {
      const k = this.getKeyData();
      if (!k || !k.issuedAt || !k.type) return 0;
      const days = C.KEY_DURATION[k.type] || 1;
      return k.issuedAt + days * 24 * 60 * 60 * 1000;
    },

    getUnlockAt() {
      const cd = this.getCooldownUntil();
      const ex = this.getKeyExpireAt();
      return Math.max(cd, ex, Date.now());
    },

    isLocked() {
      return this.getUnlockAt() > Date.now();
    },

    cleanExpired() {
      const now = Date.now();
      const cd = this.getCooldownUntil();
      const ex = this.getKeyExpireAt();
      if (cd && cd <= now) this.clearCooldown();
      if (ex && ex <= now) this.clearKeyData();
    },

    generateKey(type) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const seg = function (n) {
        let s = "";
        for (let i = 0; i < n; i++) {
          s += chars[Math.floor(Math.random() * chars.length)];
        }
        return s;
      };
      return "XH-" + type.toUpperCase() + "-" + seg(4) + "-" + seg(4) + "-" + seg(4);
    },

    issueKey(type, discordUser) {
      const now = Date.now();
      const until = now + C.COOLDOWN_MS;
      const hwid = this.getHWID();
      const key = this.generateKey(type);

      this.setCooldown(until);
      this.saveKeyData({
        key: key,
        type: type,
        issuedAt: now,
        expireAt: now + (C.KEY_DURATION[type] || 1) * 24 * 60 * 60 * 1000,
        hwid: hwid,
        discordUser: discordUser || null
      });

      return { key: key, until: until, hwid: hwid };
    },

    resetHWID() {
      const newHwid =
        this._generateHWID() + "-" +
        Math.random().toString(36).slice(2, 6).toUpperCase();
      localStorage.setItem(C.KEY_HWID, newHwid);
      this.clearKeyData();
      this.clearCooldown();
      return newHwid;
    },

    formatTime(ms) {
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
      const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const s = String(totalSec % 60).padStart(2, "0");
      return h + ":" + m + ":" + s;
    }
  };

  window.GetkeyCooldown = Cooldown;
})();
