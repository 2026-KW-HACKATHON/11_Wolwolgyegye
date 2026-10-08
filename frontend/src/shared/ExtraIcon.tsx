/**
 * shared/icons.ts 에 없는 선 아이콘 몇 개. (스탬프·제휴 가게에서 사용)
 * 공용 icons.ts 는 팀원이 같이 쓰는 파일이라 건드리지 않고, 필요한 것만 여기 따로 둔다.
 * 모양은 icons.ts 와 같은 규칙(24 그리드, currentColor 선, .icon 클래스)을 따른다.
 */
const EXTRA_ICONS = {
  check: '<svg class="icon" viewBox="0 0 24 24"><path d="m5 12.5 4.2 4.2L19 7"/></svg>',
  history: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5V8h3.5"/><path d="M12 8v4.2l2.8 1.8"/></svg>',
  qr: '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/></svg>',
  arrowLeft: '<svg class="icon" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  stamp:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M9.5 3.5h5l-.8 6.2c2.9.4 5.3 1.8 5.3 3.8v1.5H5v-1.5c0-2 2.4-3.4 5.3-3.8L9.5 3.5Z"/><path d="M5 18.5h14"/></svg>',
} as const;

type ExtraIconName = keyof typeof EXTRA_ICONS;

/** 고정 문자열 SVG만 그리므로 안전하다 (shared/Icon.tsx 와 같은 방식) */
export default function ExtraIcon({ name, className }: { name: ExtraIconName; className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: EXTRA_ICONS[name] }} />;
}
