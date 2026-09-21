import { SETTINGS_PAGE } from '../../../core/categories/categories';
import NavItem from '../shared/NavItem';
import { GEAR_GLYPH } from '../shared/icons';
import type { NavProps } from '../shared/navTypes';
import SwipeStrip from '../shared/SwipeStrip';
import './CompactLandscapeNav.css';

/**
 * 모바일 가로 하단바
 * [왼쪽 고정: 추천] [좌우 스와이프: 선택형 카테고리들] [고정: 설정] [오른쪽 끝 고정: 로그인]
 * (가로 모드에서는 상단 행에 ? 와 설정이 없으므로 설정이 하단바로 내려온다)
 */
export default function CompactLandscapeNav({
  startFixed,
  endFixed,
  scrollable,
  handlers,
  activePath,
}: NavProps) {
  return (
    <nav className="compact-landscape-nav" aria-label="카테고리">
      {startFixed && (
        <NavItem
          page={startFixed}
          icon={startFixed.icon}
          active={startFixed.path === activePath}
          handlers={handlers}
          className="compact-landscape-nav__fixed compact-landscape-nav__fixed--start"
        />
      )}
      <SwipeStrip items={scrollable} activePath={activePath} handlers={handlers} />
      <NavItem
        page={SETTINGS_PAGE}
        icon={GEAR_GLYPH}
        active={SETTINGS_PAGE.path === activePath}
        handlers={handlers}
        className="compact-landscape-nav__fixed compact-landscape-nav__fixed--settings"
      />
      {endFixed && (
        <NavItem
          page={endFixed}
          icon={endFixed.icon}
          active={endFixed.path === activePath}
          handlers={handlers}
          className="compact-landscape-nav__fixed compact-landscape-nav__fixed--end"
        />
      )}
    </nav>
  );
}