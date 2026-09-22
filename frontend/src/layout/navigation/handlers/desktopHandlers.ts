import type { NavHandlers } from './navHandlers';

/** PC용 핸들러 세트 (마우스 기반) */
export const desktopHandlers: NavHandlers = {
  onSelect: (target, go) => go(target.path),
  onHoverStart: () => {
    // TODO: PC 전용 동작 자리 (예: 카테고리 미리보기)
  },
  onHoverEnd: () => {
    // TODO
  },
};