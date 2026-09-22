import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ALL_PAGES, DEFAULT_LANDING_PATH } from '../../core/categories/categories';
import { useActivePath } from '../../core/router/useActivePath';
import { PAGE_REGISTRY } from '../../features/pageRegistry';
import { PageActiveContext } from './PageActiveContext';

/**
 * 탭 상태 보존.
 * 한 번이라도 방문한 페이지는 언마운트하지 않고 display: none 으로 숨기기만 한다.
 * 그래서 다른 카테고리에 갔다가 돌아와도 각 페이지 내부 상태가 그대로 남는다.
 * (방문하지 않은 페이지는 마운트하지 않는다.)
 */
export default function KeepAlivePages() {
  const activePath = useActivePath();
  const active = ALL_PAGES.find((p) => p.path === activePath) ?? null;
  const activeId = active?.id ?? null;

  const [visited, setVisited] = useState<string[]>([]);

  useEffect(() => {
    if (activeId) {
      setVisited((prev) => (prev.includes(activeId) ? prev : [...prev, activeId]));
    }
  }, [activeId]);

  if (!activeId) {
    // 존재하지 않는 경로는 기본 화면으로
    return <Navigate to={DEFAULT_LANDING_PATH} replace />;
  }

  // 첫 방문 프레임에서도 바로 그려지도록, 아직 visited 에 없으면 함께 계산
  const mountedIds = visited.includes(activeId) ? visited : [...visited, activeId];

  return (
    <>
      {mountedIds.map((id) => {
        const Page = PAGE_REGISTRY[id];
        if (!Page) return null;
        const isActive = id === activeId;
        return (
          <div key={id} style={{ display: isActive ? 'block' : 'none' }}>
            <PageActiveContext.Provider value={isActive}>
              <Page />
            </PageActiveContext.Provider>
          </div>
        );
      })}
    </>
  );
}