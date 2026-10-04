import { forwardRef } from 'react';
import type { LayoutMode } from '../../core/device/layoutMode';
import Icon from '../../shared/Icon';
import './SecondaryPanel.css';

/** 2차 탭에 보여줄 가게 요약. (카테고리 가게·상가정보 가게 모두 이 모양으로 바꿔서 넘긴다) */
export interface SecondaryPlace {
  id: string;
  name: string;
  /** 업종 (예: 음식 · 한식 · 백반/한정식) */
  category: string;
  address: string;
  /** 영업시간·전화·층 같은 짧은 정보 */
  facts: { label: string; value: string }[];
}

interface SecondaryPanelProps {
  place: SecondaryPlace | null;
  layout: LayoutMode;
  onClose: () => void;
}

/**
 * 2차 탭 자리. 1차 탭이나 지도에서 가게를 고르면 가게마다 있는 고유 가게 화면이 여기에 열린다. (다음 단계 구현 예정)
 * - PC·태블릿 가로, 모바일 가로: 지도 내 좌측
 * - 모바일·태블릿 세로: 지도 내 하단
 * 지금은 위치 확인용으로 가게 기본 정보만 보여준다.
 */
const SecondaryPanel = forwardRef<HTMLElement, SecondaryPanelProps>(function SecondaryPanel({ place, layout, onClose }, ref) {
  if (!place) return null;

  return (
    <aside ref={ref} className="secondary-panel" data-layout={layout} aria-label={`${place.name} 가게 정보`}>
      <div className="secondary-panel__head">
        <span className="secondary-panel__badge">2차 탭 · 준비 중</span>
        <button type="button" className="secondary-panel__close" aria-label="가게 정보 닫기" onClick={onClose}>✕</button>
      </div>
      <h2 className="secondary-panel__name">{place.name}</h2>
      {place.category && <p className="secondary-panel__category">{place.category}</p>}
      <p className="secondary-panel__meta">
        <Icon name="pin" /> {place.address || '주소 정보 없음'}
      </p>
      {place.facts.length > 0 && (
        <dl className="secondary-panel__facts">
          {place.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
        </dl>
      )}
      <p className="secondary-panel__note">가게마다 있는 고유 가게 화면은 다음 단계에서 이 자리에 열려요.</p>
    </aside>
  );
});

export default SecondaryPanel;
