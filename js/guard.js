(function () {
  "use strict";

  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toUpperCase();
    if (e.key === "F12" || e.keyCode === 123) { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && "IJC".indexOf(k) > -1) { e.preventDefault(); return false; }
    if (e.ctrlKey && (k === "U" || k === "S")) { e.preventDefault(); return false; }
    if (e.metaKey && e.altKey && "IJC".indexOf(k) > -1) { e.preventDefault(); return false; }
    if (e.metaKey && (k === "U" || k === "S")) { e.preventDefault(); return false; }
  }, true);

  document.addEventListener("contextmenu", function (e) { e.preventDefault(); }, true);
  document.addEventListener("selectstart", function (e) { e.preventDefault(); }, true);
  document.addEventListener("dragstart", function (e) { e.preventDefault(); }, true);

  if (window.top !== window.self) {
    try { window.top.location = window.self.location; }
    catch (e) { document.body.innerHTML = "<h1>Access Denied</h1>"; }
  }
})();
