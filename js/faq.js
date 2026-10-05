(function () {
  "use strict";

  var items = document.querySelectorAll(".faq-item");

  items.forEach(function (item) {
    var btn = item.querySelector(".faq-question");
    var answer = item.querySelector(".faq-answer");

    btn.addEventListener("click", function () {
      var open = item.classList.contains("open");

      items.forEach(function (other) {
        other.classList.remove("open");
        other.querySelector(".faq-answer").style.maxHeight = null;
      });

      if (!open) {
        item.classList.add("open");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });
})();
