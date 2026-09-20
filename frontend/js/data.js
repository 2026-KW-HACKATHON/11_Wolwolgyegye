/* ==========================================================================
   월계생활 - 공용 데이터 셋 & 아이콘
   Code.md 2항: 화면(객체)마다 따로 구현하되, 공통으로 쓰는 데이터 셋은
   이름을 통일해 window.WOL 네임스페이스 하나로 모아 둔다.
   ========================================================================== */

(function (global) {
  "use strict";

  // 선(stroke) 기반 아이콘. currentColor를 쓰므로 CSS 색상 변수와 함께 재사용된다.
  var ICONS = {
    building:
      '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/><path d="M10 21v-4h4v4"/></svg>',
    palette:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.7 1.6-1.5 0-.4-.15-.75-.4-1.05-.25-.3-.4-.65-.4-1.05 0-.8.65-1.4 1.4-1.4h1.6A4.2 4.2 0 0 0 20 12 9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7.5" r="1.1"/><circle cx="15" cy="8" r="1.1"/><circle cx="17" cy="12" r="1.1"/></svg>',
    wheel:
      '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.4"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M18.4 5.6l-4.2 4.2M9.8 14.2l-4.2 4.2"/></svg>',
    tag:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M12.6 3.5H6a2.5 2.5 0 0 0-2.5 2.5v6.6c0 .53.21 1.04.59 1.41l8.8 8.8a2 2 0 0 0 2.82 0l6.6-6.6a2 2 0 0 0 0-2.82l-8.8-8.8a2 2 0 0 0-1.41-.59Z"/><circle cx="8.2" cy="8.2" r="1.3"/></svg>',
    ticket:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a1.7 1.7 0 0 0 0 3V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a1.7 1.7 0 0 0 0-3V9Z"/><path d="M9 7v10" stroke-dasharray="2.4 2.4"/></svg>',
    storefront:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M5 10v9.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></svg>',
    calendar:
      '<svg class="icon" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    gift:
      '<svg class="icon" viewBox="0 0 24 24"><rect x="3.5" y="9" width="17" height="12" rx="1.5"/><path d="M3.5 13.5h17"/><path d="M12 9v12"/><path d="M12 9C9.5 9 8 7.6 8 6a2 2 0 0 1 4-.4A2 2 0 0 1 16 6c0 1.6-1.5 3-4 3Z"/></svg>',
    store:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M4 21V10M20 21V10M4 10l1-6h14l1 6M4 10h16"/><path d="M9 21v-6h6v6"/></svg>',
    gear:
      '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.8-1.4-2-3.5-2.1.7a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.5 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.1-.7-2 3.5 1.8 1.4a7.6 7.6 0 0 0 0 3l-1.8 1.4 2 3.5 2.1-.7c.77.66 1.65 1.17 2.6 1.5L10 22h4l.5-2.3a7.6 7.6 0 0 0 2.6-1.5l2.1.7 2-3.5-1.8-1.4Z"/></svg>',
    chevronDown:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    chevronUp:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    chevronRight:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    pin:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/></svg>',
    heart:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.8-9.2C.9 7.9 2.4 4.5 5.9 4c2-.3 3.7.7 6.1 3 2.4-2.3 4.1-3.3 6.1-3 3.5.5 5 3.9 3.7 7.3-2.3 4.6-9.8 9.2-9.8 9.2Z"/></svg>',
    search:
      '<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    coffee:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 6c0-1 1-1 1-2M11 6c0-1 1-1 1-2"/></svg>',
    bread:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M4 13c0-5 3.5-9 8-9s8 4 8 9-3 6-8 6-8-1-8-6Z"/><path d="M9 9c1-1 2-1.5 3-1.5S14 8 15 9"/></svg>',
    sofa:
      '<svg class="icon" viewBox="0 0 24 24"><path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M3 12h18v4a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 16v-4Z"/><path d="M4 17.5V20M20 17.5V20"/></svg>'
  };

  // 순서도(Base.md)에 명시된 6개 기본 카테고리
  var CATEGORIES = [
    { key: "space", label: "공간 대여", desc: "스터디룸 · 모임공간\n상업공간까지", icon: "building" },
    { key: "class", label: "원데이 클래스", desc: "취미 · 공예 · 체험 클래스", icon: "palette" },
    { key: "roulette", label: "룰렛", desc: "매일 도전하는\n행운의 기회", icon: "wheel" },
    { key: "sale", label: "마감세일", desc: "지금이 바로\n특템 타이밍!", icon: "tag" },
    { key: "coupon", label: "쿠폰", desc: "다양한 할인 쿠폰 모음", icon: "ticket" },
    { key: "partner", label: "제휴 가게", desc: "우리 동네\n제휴 매장을 만나보세요", icon: "storefront" }
  ];

  // 화면 2의 탭 필터 (전체 + 카테고리 일부)
  var NEARBY_FILTERS = [
    { key: "all", label: "전체" },
    { key: "class", label: "원데이 클래스" },
    { key: "roulette", label: "룰렛" },
    { key: "sale", label: "마감세일" }
  ];

  // 지도/리스트에 표시할 예시 가게 데이터 (사진 · 거리 · 주소 · 지도는 예시입니다)
  var STORES = [
    {
      id: "coffee",
      name: "월계 커피",
      icon: "coffee",
      tags: [{ type: "coupon", label: "쿠폰" }, { type: "discount", label: "할인" }],
      distance: "150m",
      address: "월계1동 광운로 20",
      categories: ["all", "sale"],
      position: { left: "28%", top: "30%" }
    },
    {
      id: "bakery",
      name: "오늘빵 베이커리",
      icon: "bread",
      tags: [{ type: "discount", label: "할인" }, { type: "partner", label: "제휴" }],
      distance: "320m",
      address: "월계1동 월계로 105",
      categories: ["all", "sale"],
      position: { left: "62%", top: "24%" }
    },
    {
      id: "studio",
      name: "월계 스터디룸",
      icon: "sofa",
      tags: [{ type: "space", label: "공간대여" }, { type: "partner", label: "제휴" }],
      distance: "480m",
      address: "월계1동 광운로 62",
      categories: ["all", "class"],
      position: { left: "45%", top: "58%" }
    }
  ];

  // 사장님 앱 관리 메뉴
  var OWNER_MENU = [
    { key: "reservation", label: "예약 관리", desc: "신청 현황을\n확인하고 관리해요", icon: "calendar" },
    { key: "roulette", label: "룰렛 혜택", desc: "우리 가게만의\n혜택을 설정해요", icon: "gift" },
    { key: "sale", label: "마감세일", desc: "남은 상품을\n알리고 판매해요", icon: "tag" },
    { key: "coupon", label: "쿠폰 관리", desc: "쿠폰을 발행하고\n관리해요", icon: "ticket" },
    { key: "info", label: "가게 정보", desc: "가게 소개와 운영 정보를 관리해요", icon: "store", wide: true }
  ];

  global.WOL = {
    ICONS: ICONS,
    CATEGORIES: CATEGORIES,
    NEARBY_FILTERS: NEARBY_FILTERS,
    STORES: STORES,
    OWNER_MENU: OWNER_MENU,
    NEIGHBORHOOD: "월계1동"
  };
})(window);
