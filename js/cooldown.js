(function () {
  "use strict";

  var C = window.GETKEY_CONFIG;

  var HWID = {
    get: function () {
      var v = localStorage.getItem(C.KEY_HWID);
      if (!v) {
        v = this.generate();
        localStorage.setItem(C.KEY_HWID, v);
      }
      return v;
    },

    generate: function () {
      var raw = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0
      ].join("|");

      var h = 0;
      for (var i = 0; i < raw.length; i++) {
        h = ((h << 5) - h) + raw.charCodeAt(i);
        h = h & h;
      }

      return "HW-" + Math.abs(h).toString(36).toUpperCase();
    },

    rotate: function () {
      var v = this.generate() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      localStorage.setItem(C.KEY_HWID, v);
      return v;
    }
  };

  var Time = {
    format: function (ms) {
      var s = Math.max(0, Math.floor(ms / 1000));
      var hh = String(Math.floor(s / 3600)).padStart(2, "
