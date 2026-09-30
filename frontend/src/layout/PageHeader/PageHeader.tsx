import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALL_PAGES, SETTINGS_PAGE } from '../../core/categories/categories';
import { useLayoutMode } from '../../core/device/LayoutModeContext';
import { useActivePath } from '../../core/router/useActivePath';
import HelpPopup from '../HelpPopup/HelpPopup';
import Icon from '../../shared/Icon';
import { GEAR_GLYPH } from '../navigation/shared/icons';
import './PageHeader.css';

/**
 * 모바일/태블릿용 상단 행 (PC 에서는 렌더링하지 않음)
 * - compact           : [카테고리명] ...... [?] [톱니바퀴]
 * - compact-landscape : [카테고리명] 만 (? 와 설정 없음. 설정은 하단바에 고정)
 */
export default function PageHeader() {
  const mode = useLayoutMode();
  const navigate = useNavigate();
  const activePath = useActivePath();
  const [helpOpen, setHelpOpen] = useState(false);

  const page = ALL_PAGES.find((p) => p.path === activePath) ?? null;
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  // 다른 화면으로 이동하면 안내창은 닫는다
  useEffect(() => {
    setHelpOpen(false);
  }, [activePath]);

  if (mode === 'desktop') return null;

  const showActions = mode === 'compact';

  return (
    <header className="page-header" data-layout={mode} data-home={activePath === '/recommend'}>
      {activePath === '/recommend' ? <div className="page-header__brand"><span className="page-header__brand-mark" aria-hidden="true"><Icon name="storefront" /></span><strong>월월계계</strong><span className="page-header__tagline">가까워지는 우리 동네</span></div> : <h1 className="page-header__title">{page?.name ?? ''}</h1>}

      {showActions && (
        <div className="page-header__actions">
          <button
            type="button"
            className="page-header__help"
            aria-label="이 화면 안내"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
          <button
            type="button"
            className="page-header__settings"
            aria-label="설정"
            aria-current={activePath === SETTINGS_PAGE.path ? 'page' : undefined}
            onClick={() => navigate(SETTINGS_PAGE.path)}
          >
            {GEAR_GLYPH}
          </button>
        </div>
      )}

      {showActions && page && (
        <HelpPopup open={helpOpen} title={page.name} body={page.help} onClose={closeHelp} />
      )}
    </header>
  );
}
