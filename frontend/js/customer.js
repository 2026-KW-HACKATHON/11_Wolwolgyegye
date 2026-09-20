/* ==========================================================================
   월계생활 - 손님 앱 동작 (첫 화면 ↔ 내 주변 가게 화면 전환, 목록/지도 렌더링)
   ========================================================================== */

(function () {
  "use strict";

  var ICONS = window.WOL.ICONS;
  var CATEGORIES = window.WOL.CATEGORIES;
  var NEARBY_FILTERS = window.WOL.NEARBY_FILTERS;
  var STORES = window.WOL.STORES;
  var NEIGHBORHOOD = window.WOL.NEIGHBORHOOD;

  var state = {
    filter: "all",
    sort: "distance", // distance | name
    likes: {}
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".loc-label").forEach(function (el) {
      el.textContent = NEIGHBORHOOD;
    });

    renderCategories();
    renderFilters();
    renderMapPins();
    renderStores();
    bindScreenSwitching();
    bindSort();
    bindToast();
  });

  function renderCategories() {
    var grid = document.getElementById("category-grid");
    if (!grid) return;
    grid.innerHTML = CATEGORIES.map(function (cat) {
      return (
        '<button class="card category-card" type="button" data-toast="' +
        cat.label +
        ' 준비 중이에요">' +
        '<span class="cat-icon">' + ICONS[cat.icon] + "</span>" +
        '<span class="cat-label">' + cat.label + "</span>" +
        '<span class="cat-desc">' + cat.desc + "</span>" +
        "</button>"
      );
    }).join("");
  }

  function renderFilters() {
    var wrap = document.getElementById("filter-tabs");
    if (!wrap) return;
    wrap.innerHTML = NEARBY_FILTERS.map(function (f) {
      var icon = f.key === "class" ? ICONS.palette : f.key === "roulette" ? ICONS.wheel : f.key === "sale" ? ICONS.tag : "";
      return (
        '<button class="filter-chip' + (f.key === state.filter ? " is-active" : "") + '" type="button" data-filter="' +
        f.key + '">' + icon + "<span>" + f.label + "</span></button>"
      );
    }).join("");

    wrap.querySelectorAll(".filter-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter");
        renderFilters();
        renderStores();
      });
    });
  }

  function renderMapPins() {
    var layer = document.getElementById("map-pins");
    if (!layer) return;
    layer.innerHTML = STORES.map(function (store) {
      return (
        '<div class="map-pin" style="left:' + store.position.left + ";top:" + store.position.top + '">' +
        '<span class="pin-badge">' + ICONS[store.icon] + "</span>" +
        '<span class="pin-label">' + store.name + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function getVisibleStores() {
    var list = STORES.filter(function (s) {
      return state.filter === "all" || s.categories.indexOf(state.filter) !== -1;
    });
    list = list.slice();
    if (state.sort === "name") {
      list.sort(function (a, b) {
        return a.name.localeCompare(b.name, "ko");
      });
    } else {
      list.sort(function (a, b) {
        return parseInt(a.distance) - parseInt(b.distance);
      });
    }
    return list;
  }

  function renderStores() {
    var list = getVisibleStores();
    var listEl = document.getElementById("store-list");
    var countEl = document.getElementById("store-count");
    if (countEl) countEl.textContent = "주변 가게 " + list.length + "곳";
    if (!listEl) return;

    listEl.innerHTML = list.map(function (store) {
      var tags = store.tags.map(function (t) {
        return '<span class="tag tag--' + t.type + '">' + t.label + "</span>";
      }).join("");
      var liked = !!state.likes[store.id];
      return (
        '<li class="card store-item">' +
        '<div class="store-thumb">' + ICONS[store.icon] + "</div>" +
        '<div class="store-info">' +
        '<div class="store-name-row"><span class="store-name">' + store.name + "</span>" + tags + "</div>" +
        '<div class="store-meta">' + ICONS.pin + "<span>" + store.distance + " · " + store.address + "</span></div>" +
        "</div>" +
        '<button class="store-like' + (liked ? " is-active" : "") + '" type="button" data-like="' + store.id + '" aria-label="찜하기">' + ICONS.heart + "</button>" +
        "</li>"
      );
    }).join("");

    listEl.querySelectorAll("[data-like]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-like");
        state.likes[id] = !state.likes[id];
        renderStores();
      });
    });
  }

  function bindSort() {
    document.querySelectorAll(".sort-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.sort = btn.getAttribute("data-sort");
        document.querySelectorAll(".sort-btn").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        renderStores();
      });
    });
  }

  /* ---------------------------------------------------------------------
     화면 전환: 클릭/터치 모두 지원.
     - 첫 화면 상단 핸들을 아래로 당기거나 클릭 → 내 주변 가게 화면
     - 내 주변 가게 화면 하단 핸들을 위로 밀거나 클릭 → 첫 화면
     --------------------------------------------------------------------- */
  function bindScreenSwitching() {
    var stack = document.getElementById("screen-stack");
    var toNearby = document.getElementById("handle-to-nearby");
    var toHome = document.getElementById("handle-to-home");
    if (!stack) return;

    function showNearby() {
      stack.classList.add("is-nearby");
    }
    function showHome() {
      stack.classList.remove("is-nearby");
    }

    if (toNearby) {
      toNearby.addEventListener("click", showNearby);
      attachDrag(toNearby, "down", showNearby);
    }
    if (toHome) {
      toHome.addEventListener("click", showHome);
      attachDrag(toHome, "up", showHome);
    }
  }

  function attachDrag(el, direction, onCommit) {
    var startY = null;
    var threshold = 36;

    el.addEventListener("pointerdown", function (e) {
      startY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener("pointermove", function (e) {
      if (startY === null) return;
      var delta = e.clientY - startY;
      if (direction === "down" && delta > threshold) {
        onCommit();
        startY = null;
      } else if (direction === "up" && delta < -threshold) {
        onCommit();
        startY = null;
      }
    });

    el.addEventListener("pointerup", function () {
      startY = null;
    });
    el.addEventListener("pointercancel", function () {
      startY = null;
    });
  }

  /* --- 간단한 토스트: 아직 구현되지 않은 하위 화면 클릭 시 안내 --- */
  function bindToast() {
    var toast = document.getElementById("toast");
    if (!toast) return;
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
})();
