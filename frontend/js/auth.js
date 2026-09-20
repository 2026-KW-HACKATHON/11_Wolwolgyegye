/* ==========================================================================
   월계생활 - 로그인 상태 (손님 앱 / 사장님 앱 공통)
   실제 인증 서버가 붙기 전까지는 로컬에 이름만 저장해두는 임시 로그인이다.
   ========================================================================== */

(function (global) {
  "use strict";

  var STORAGE_KEY = "wol_user_name";
  var listeners = [];

  function getUser() {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch (e) {
      return null;
    }
  }

  function setUser(name) {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch (e) {
      /* localStorage 접근 불가 시 로그인 상태는 세션 동안 화면에만 반영 */
    }
    notify();
  }

  function clearUser() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    notify();
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function notify() {
    var user = getUser();
    listeners.forEach(function (fn) {
      fn(user);
    });
  }

  global.WOL = global.WOL || {};
  global.WOL.Auth = {
    getUser: getUser,
    setUser: setUser,
    clearUser: clearUser,
    onChange: onChange
  };
})(window);

(function () {
  "use strict";

  var Auth = window.WOL.Auth;
  var toastTimer = null;

  document.addEventListener("DOMContentLoaded", function () {
    renderSlots();
    bindModal();
    Auth.onChange(renderSlots);
  });

  function renderSlots() {
    var user = Auth.getUser();
    document.querySelectorAll("[data-auth-slot]").forEach(function (slot) {
      slot.innerHTML = user
        ? '<button class="auth-user" type="button" data-action="logout" aria-label="로그아웃">' +
          '<span class="auth-user-badge">' + escapeHtml(user.charAt(0)) + "</span>" +
          '<span class="auth-user-name">' + escapeHtml(user) + "님</span>" +
          "</button>"
        : '<button class="auth-btn" type="button" data-action="login">로그인</button>';
    });

    document.querySelectorAll('[data-action="login"]').forEach(function (btn) {
      btn.addEventListener("click", openModal);
    });
    document.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        Auth.clearUser();
        showToast("로그아웃 되었어요");
      });
    });
  }

  function bindModal() {
    var overlay = document.getElementById("auth-modal-overlay");
    if (!overlay) return;

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });

    var closeBtn = overlay.querySelector(".modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    overlay.querySelectorAll("[data-provider]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var provider = btn.getAttribute("data-provider");
        Auth.setUser(provider + " 사용자");
        closeModal();
        showToast(provider + " 계정으로 로그인했어요");
      });
    });

    var form = overlay.querySelector(".auth-name-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = form.querySelector(".auth-name-input");
        var name = (input.value || "").trim();
        if (!name) return;
        Auth.setUser(name);
        closeModal();
        showToast(name + "님, 환영해요!");
      });
    }
  }

  function openModal() {
    var overlay = document.getElementById("auth-modal-overlay");
    if (!overlay) return;
    overlay.hidden = false;
    var input = overlay.querySelector(".auth-name-input");
    if (input) {
      input.value = "";
      setTimeout(function () {
        input.focus();
      }, 50);
    }
  }

  function closeModal() {
    var overlay = document.getElementById("auth-modal-overlay");
    if (overlay) overlay.hidden = true;
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 1600);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
