/* ==========================================================================
   월계생활 사장님 - 관리 메뉴 렌더링
   ========================================================================== */

(function () {
  "use strict";

  var ICONS = window.WOL.ICONS;
  var OWNER_MENU = window.WOL.OWNER_MENU;

  document.addEventListener("DOMContentLoaded", function () {
    var grid = document.getElementById("owner-menu-grid");
    if (grid) {
      grid.innerHTML = OWNER_MENU.map(function (item) {
        return (
          '<button class="card owner-menu-item' + (item.wide ? " is-wide" : "") + '" type="button" data-toast="' +
          item.label + ' 화면은 준비 중이에요">' +
          '<span class="menu-icon">' + ICONS[item.icon] + "</span>" +
          '<span class="menu-text"><span class="menu-label">' + item.label + '</span><span class="menu-desc">' + item.desc + "</span></span>" +
          '<span class="menu-chevron">' + ICONS.chevronRight + "</span>" +
          "</button>"
        );
      }).join("");
    }

    var toast = document.getElementById("toast");
    if (toast) {
      var timer = null;
      document.body.addEventListener("click", function (e) {
        var target = e.target.closest("[data-toast]");
        if (!target) return;
        toast.textContent = target.getAttribute("data-toast");
        toast.classList.add("is-visible");
        clearTimeout(timer);
        timer = setTimeout(function () {
          toast.classList.remove("is-visible");
        }, 1600);
      });
    }
  });
})();
