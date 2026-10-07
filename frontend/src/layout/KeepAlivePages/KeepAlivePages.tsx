import { useEffect, useState } from 'react';
import { ALL_PANELS } from '../../core/categories/categories';
import { PAGE_REGISTRY } from '../../features/pageRegistry';
import SwipePanel, { type PanelState } from '../SwipePanel/SwipePanel';
import { PageActiveContext } from './PageActiveContext';

interface KeepAlivePagesProps {
  activeId: string;
  axis: 'x' | 'y';
  /** 1차 탭이 올라오는 지도 영역 크기 (px) */
  stage: { width: number; height: number };
  states: Record<string, PanelState>;
  onStateChange: (id: string, state: PanelState) => void;
  onVisibleChange: (size: number) => void;
  /** PC·태블릿 가로: 1차 탭을 끌지 않고 눌러서 닫기 / 열기만 */
  toggleOnly: boolean;
}

/** 가로 화면에서 반쯤 열린 탭이 지도 영역을 이 비율 이상 덮지 않게 한다 */
const MAX_HALF_RATIO_X = 0.8;

/**
 * 카테고리마다 하나씩 있는 1차 탭(스와이프 탭)들.
 * 한 번이라도 연 탭은 언마운트하지 않고 숨기기만 해서, 다른 카테고리에 갔다가 돌아와도 내용·열림 상태가 그대로 남는다.
 */
export default function KeepAlivePages({ activeId, axis, stage, states, onStateChange, onVisibleChange, toggleOnly }: KeepAlivePagesProps) {
  const [visited, setVisited] = useState<string[]>([]);

  useEffect(() => {
    setVisited((prev) => (prev.includes(activeId) ? prev : [...prev, activeId]));
  }, [activeId]);

  // 첫 방문 프레임에서도 바로 그려지도록, 아직 visited 에 없으면 함께 계산
  const mountedIds = visited.includes(activeId) ? visited : [...visited, activeId];
  const full = axis === 'y' ? stage.height : stage.width;

  return (
    <>
      {mountedIds.map((id) => {
        const meta = ALL_PANELS.find((p) => p.id === id);
        const Page = PAGE_REGISTRY[id];
        if (!meta || !Page) return null;
        const isActive = id === activeId;
        const half = axis === 'y'
          ? Math.round(stage.height * meta.sheetHalf)
          : Math.min(meta.panelHalf, Math.round(stage.width * MAX_HALF_RATIO_X));
        return (
          <SwipePanel
            key={id}
            id={id}
            axis={axis}
            state={states[id] ?? 'half'}
            onStateChange={(next) => onStateChange(id, next)}
            half={half}
            full={full}
            active={isActive}
            title={meta.name}
            onVisibleChange={onVisibleChange}
            toggleOnly={toggleOnly}
          >
            <PageActiveContext.Provider value={isActive}>
              <div className="panel-page" data-page={id}>
                <Page />
              </div>
            </PageActiveContext.Provider>
          </SwipePanel>
        );
      })}
    </>
  );
}
