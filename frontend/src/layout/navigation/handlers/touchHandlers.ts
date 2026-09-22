import type { NavHandlers } from './navHandlers';

/** 모바일/태블릿용 핸들러 세트 (터치 기반). hover 는 없다. */
export const touchHandlers: NavHandlers = {
  onSelect: (target, go) => go(target.path),
  onLongPress: () => {
    // TODO: 터치 전용 동작 자리
  },
};