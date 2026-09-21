import NavItem from '../shared/NavItem';
import type { NavProps } from '../shared/navTypes';
import SwipeStrip from '../shared/SwipeStrip';
import './CompactNav.css';

/**
 * 모바일 세로 + 태블릿(세로/가로) 하단바
 * [왼쪽 고정: 추천] [좌우 스와이프: 선택형 카테고리들] [오른쪽 고정: 로그인]
 */
export default function CompactNav({ startFixed, endFixed, scrollable, handlers, activePath }: NavProps) {
  return (
    <nav className="compact-nav" aria-label="카테고리">
      {startFixed && (
        <NavItem
          page={startFixed}
          icon={startFixed.icon}
          active={startFixed.path === activePath}
          handlers={handlers}
          className="compact-nav__fixed compact-nav__fixed--start"
        />
      )}
      <SwipeStrip items={scrollable} activePath={activePath} handlers={handlers} />
      {endFixed && (
        <NavItem
          page={endFixed}
          icon={endFixed.icon}
          active={endFixed.path === activePath}
          handlers={handlers}
          className="compact-nav__fixed compact-nav__fixed--end"
        />
      )}
    </nav>
  );
}