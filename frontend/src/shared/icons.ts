/**
 * 선(stroke) 기반 아이콘 모음. develop 브랜치 frontend/js/data.js 의 ICONS 를 이식.
 * currentColor 를 쓰므로 감싸는 요소의 색상(CSS 변수)과 함께 재사용된다.
 */
export const ICONS = {
  building:
    '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/><path d="M10 21v-4h4v4"/></svg>',
  house:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/></svg>',
  palette:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.7 1.6-1.5 0-.4-.15-.75-.4-1.05-.25-.3-.4-.65-.4-1.05 0-.8.65-1.4 1.4-1.4h1.6A4.2 4.2 0 0 0 20 12 9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7.5" r="1.1"/><circle cx="15" cy="8" r="1.1"/><circle cx="17" cy="12" r="1.1"/></svg>',
  wheel:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.4"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M18.4 5.6l-4.2 4.2M9.8 14.2l-4.2 4.2"/></svg>',
  tag: '<svg class="icon" viewBox="0 0 24 24"><path d="M12.6 3.5H6a2.5 2.5 0 0 0-2.5 2.5v6.6c0 .53.21 1.04.59 1.41l8.8 8.8a2 2 0 0 0 2.82 0l6.6-6.6a2 2 0 0 0 0-2.82l-8.8-8.8a2 2 0 0 0-1.41-.59Z"/><circle cx="8.2" cy="8.2" r="1.3"/></svg>',
  ticket:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a1.7 1.7 0 0 0 0 3V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a1.7 1.7 0 0 0 0-3V9Z"/><path d="M9 7v10" stroke-dasharray="2.4 2.4"/></svg>',
  storefront:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M5 10v9.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></svg>',
  calendar:
    '<svg class="icon" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
  gift: '<svg class="icon" viewBox="0 0 24 24"><rect x="3.5" y="9" width="17" height="12" rx="1.5"/><path d="M3.5 13.5h17"/><path d="M12 9v12"/><path d="M12 9C9.5 9 8 7.6 8 6a2 2 0 0 1 4-.4A2 2 0 0 1 16 6c0 1.6-1.5 3-4 3Z"/></svg>',
  store:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M4 21V10M20 21V10M4 10l1-6h14l1 6M4 10h16"/><path d="M9 21v-6h6v6"/></svg>',
  chevronDown: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  chevronUp: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  chevronRight: '<svg class="icon" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  pin: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/></svg>',
  heart:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.8-9.2C.9 7.9 2.4 4.5 5.9 4c2-.3 3.7.7 6.1 3 2.4-2.3 4.1-3.3 6.1-3 3.5.5 5 3.9 3.7 7.3-2.3 4.6-9.8 9.2-9.8 9.2Z"/></svg>',
  search: '<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  coffee:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 6c0-1 1-1 1-2M11 6c0-1 1-1 1-2"/></svg>',
  sofa: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M3 12h18v4a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 16v-4Z"/><path d="M4 17.5V20M20 17.5V20"/></svg>',
  paletteColor:
    '<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.7 1.6-1.5 0-.4-.15-.75-.4-1.05-.25-.3-.4-.65-.4-1.05 0-.8.65-1.4 1.4-1.4h1.6A4.2 4.2 0 0 0 20 12 9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r="1.3" stroke="none" style="fill:var(--primary-500)"/><circle cx="10.5" cy="7.5" r="1.3" stroke="none" style="fill:var(--strong-500)"/><circle cx="15" cy="8" r="1.3" stroke="none" style="fill:var(--primary-400)"/><circle cx="17" cy="12" r="1.3" stroke="none" style="fill:var(--accent-400)"/></svg>',
  megaphone:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M3 10v4a1 1 0 0 0 1 1h2l2.5 5.5V3.5L6 9H4a1 1 0 0 0-1 1Z"/><path d="M9.5 5.5 19 3v18l-9.5-2.5"/><path d="M19 9.5a3 3 0 0 1 0 5"/></svg>',
  compass:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M14.8 9.2 13 13l-3.8 1.8L11 11l3.8-1.8Z"/></svg>',
  user: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  locate:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
} as const;

export type IconName = keyof typeof ICONS;