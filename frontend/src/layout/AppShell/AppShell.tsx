import { useLayoutMode } from '../../core/device/LayoutModeContext';
import { useActivePath } from '../../core/router/useActivePath';
import KeepAlivePages from '../KeepAlivePages/KeepAlivePages';
import Navigation from '../navigation/Navigation';
import PageHeader from '../PageHeader/PageHeader';
import './AppShell.css';

/**
 * 앱 셸: 모든 화면이 공유하는 공통 레이아웃.
 * 카테고리 페이지는 여기서 만들어 둔 콘텐츠 슬롯(<main>)에만 들어가며, 자체 네비게이션을 만들지 않는다.
 *
 * - desktop : [네비(상단)] [콘텐츠]
 * - compact : [페이지 헤더] [콘텐츠] [네비(하단)]
 */
export default function AppShell() {
  const mode = useLayoutMode();
  const activePath = useActivePath();
  const isDesktop = mode === 'desktop';

  return (
    <div className="app-shell" data-layout={mode}>
      {isDesktop ? <Navigation /> : <PageHeader />}
      <main className={`app-shell__main${activePath === '/recommend' ? ' app-shell__main--recommend' : ''}`}>
        <KeepAlivePages />
      </main>
      {!isDesktop && <Navigation />}
    </div>
  );
}
