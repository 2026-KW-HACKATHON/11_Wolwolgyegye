import { forwardRef, useEffect, useState } from 'react';
import type { LayoutMode } from '../../core/device/layoutMode';
import { fetchStoreDetail, type StoreDetail } from '../../core/source/storeDetail';
import Icon from '../../shared/Icon';
import StoreDetailSections from './StoreDetailSections';
import './SecondaryPanel.css';

/** 2차 탭에 보여줄 가게 요약. (카테고리 가게·지도 가게 모두 이 모양으로 바꿔서 넘긴다) */
export interface SecondaryPlace {
  /** DB stores.id. 이 id 로 가게에 딸린 정보를 더 읽어 온다 */
  id: string;
  name: string;
  /** 업종 (예: 한식 · 백반/한정식) */
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

type DetailState = { id: string; detail: StoreDetail | null } | null;

/**
 * 2차 탭 = 가게 화면. 1차 탭이나 지도에서 가게를 고르면 열린다.
 * - PC·태블릿 가로, 모바일 가로: 지도 내 좌측
 * - 모바일·태블릿 세로: 지도 내 하단
 * 위쪽은 넘겨받은 요약을 바로 보여주고, 아래쪽은 DB 에서 가게에 딸린 정보(메뉴·영업시간·세일·제휴·공간대여·클래스·스탬프)를
 * 읽어 와서 쭉 이어 붙인다. 내용이 길면 이 탭 안에서 스크롤된다.
 */
const SecondaryPanel = forwardRef<HTMLElement, SecondaryPanelProps>(function SecondaryPanel({ place, layout, onClose }, ref) {
  const id = place?.id ?? null;
  const [loaded, setLoaded] = useState<DetailState>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void fetchStoreDetail(id).then((detail) => { if (!cancelled) setLoaded({ id, detail }); });
    return () => { cancelled = true; };
  }, [id]);

  if (!place) return null;
  // 다른 가게로 바뀐 직후에는 이전 가게 정보를 보여주지 않는다
  const current = loaded?.id === place.id ? loaded : null;
  const detail = current?.detail ?? null;

  return (
    <aside ref={ref} className="secondary-panel" data-layout={layout} aria-label={`${place.name} 가게 정보`}>
      <div className="secondary-panel__head">
        {detail?.isMock ? <span className="secondary-panel__badge is-mock">예시 가게</span> : <span />}
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
      {!current ? <p className="sd-empty" aria-live="polite">가게 정보를 불러오는 중…</p>
        : detail ? <StoreDetailSections detail={detail} />
          : <p className="sd-empty">가게 정보를 불러오지 못했어요.</p>}
    </aside>
  );
});

export default SecondaryPanel;
