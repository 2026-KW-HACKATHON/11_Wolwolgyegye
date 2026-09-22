import type { VisibleCategories } from '../../../core/categories/useVisibleCategories';
import type { NavHandlers } from '../handlers/navHandlers';

/** 3종 네비게이션(compact / compact-landscape / desktop)이 공통으로 받는 값 */
export interface NavProps extends VisibleCategories {
  handlers: NavHandlers;
  activePath: string;
}