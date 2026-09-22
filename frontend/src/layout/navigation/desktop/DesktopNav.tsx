import { useNavigate } from 'react-router-dom';
import { DEFAULT_LANDING_PATH, SETTINGS_PAGE } from '../../../core/categories/categories';
import NavItem from '../shared/NavItem';
import { GEAR_GLYPH } from '../shared/icons';
import type { NavProps } from '../shared/navTypes';
import './DesktopNav.css';

/**
 * PC 상단 영역
 * 1행(홈페이지 헤더): [서비스 이름] ............ [설정] [로그인]
 * 2행(카테고리 행)  : [추천(강조)] [나머지 카테고리 나열]   (스와이프 없음)
 */
export default function DesktopNav({ startFixed, endFixed, scrollable, handlers, activePath }: NavProps) {
  const navigate = useNavigate();

  return (
    <header className="desktop-nav">
      <div className="desktop-nav__top">
        <button
          type="button"
          className="desktop-nav__brand"
          onClick={() => navigate(DEFAULT_LANDING_PATH)}
        >
          월월계계
        </button>
        <div className="desktop-nav__utils">
          <NavItem
            page={SETTINGS_PAGE}
            icon={GEAR_GLYPH}
            active={SETTINGS_PAGE.path === activePath}
            handlers={handlers}
            className="desktop-nav__util"
          />
          {endFixed && (
            <NavItem
              page={endFixed}
              icon={endFixed.icon}
              active={endFixed.path === activePath}
              handlers={handlers}
              className="desktop-nav__util"
            />
          )}
        </div>
      </div>

      <nav className="desktop-nav__row" aria-label="카테고리">
        {startFixed && (
          <NavItem
            page={startFixed}
            icon={startFixed.icon}
            active={startFixed.path === activePath}
            handlers={handlers}
            className="desktop-nav__category desktop-nav__category--emphasis"
          />
        )}
        {scrollable.map((c) => (
          <NavItem
            key={c.id}
            page={c}
            icon={c.icon}
            active={c.path === activePath}
            handlers={handlers}
            className="desktop-nav__category"
          />
        ))}
      </nav>
    </header>
  );
}