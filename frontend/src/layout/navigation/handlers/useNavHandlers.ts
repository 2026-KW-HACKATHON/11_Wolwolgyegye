import type { LayoutMode } from '../../../core/device/layoutMode';
import { desktopHandlers } from './desktopHandlers';
import type { NavHandlers } from './navHandlers';
import { touchHandlers } from './touchHandlers';

/** 기기 모드에 맞는 핸들러 세트를 고른다. (CSS 위치뿐 아니라 JS 로직도 여기서 분기) */
export function useNavHandlers(mode: LayoutMode): NavHandlers {
  return mode === 'desktop' ? desktopHandlers : touchHandlers;
}