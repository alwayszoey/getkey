(function () {
  "use strict";

  const items = document.querySelectorAll(".faq-item");

  items.forEach(function (item) {
    const btn = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");

    btn.addEventListener("click", function () {
      const isOpen = item.classList.contains("open");

      items.forEach(function (other) {
        other.classList.remove("open");
        other.querySelector(".faq-answer").style.maxHeight = null;
      });

      if (!isOpen) {
        item.classList.add("open");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });
})();
