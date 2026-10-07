import type { Store } from '../../core/types/place';

const PREVIEW_POINTS = [[25, 33], [72, 36], [48, 46], [22, 56], [77, 58], [48, 68]];

/** 로컬에서 SDK 키 없이 배치를 검토하는 도식. 실제 도로나 길찾기 지도가 아니다. */
export default function MapPreview({ stores, selectedId, onSelect }: {
  stores: Store[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const previewStores = stores.slice(0, PREVIEW_POINTS.length);
  const selectedStore = stores.find((store) => store.id === selectedId);
  if (selectedStore && !previewStores.some((store) => store.id === selectedId)) previewStores[previewStores.length - 1] = selectedStore;
  return <div className="rp-map-preview" aria-label="예시 가게 배치 미리보기">
    <svg className="rp-preview-drawing" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="600" height="900" fill="var(--rp-map-ground)" />
      <g fill="var(--rp-map-block)">
        <rect x="36" y="45" width="103" height="118" rx="14" /><rect x="161" y="33" width="74" height="130" rx="10" />
        <rect x="371" y="44" width="84" height="159" rx="14" /><rect x="476" y="67" width="112" height="136" rx="14" />
        <rect x="36" y="250" width="122" height="94" rx="12" /><rect x="189" y="243" width="75" height="105" rx="12" />
        <rect x="378" y="288" width="168" height="113" rx="14" /><rect x="371" y="443" width="112" height="94" rx="14" />
        <rect x="38" y="445" width="90" height="126" rx="14" /><rect x="155" y="455" width="104" height="69" rx="14" />
        <rect x="46" y="687" width="183" height="139" rx="14" /><rect x="385" y="705" width="161" height="118" rx="14" />
      </g>
      <path d="M-40 602q180-96 300 6t380-27v75q-200 110-361 7T-40 670Z" fill="var(--rp-map-park)" />
      <g fill="none" stroke="var(--rp-map-road)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M292-30 303 165 330 317 292 460 317 640 288 930" strokeWidth="35" />
        <path d="M-20 193 135 200 303 180 451 234 635 231M-20 391 150 389 303 404 630 418M-20 652 143 620 320 658 631 676" strokeWidth="25" />
        <path d="M163-10v185m17 28-12 181m-24 16 7 214M475 260l9 141m-3 20 34 161" strokeWidth="11" />
      </g>
      <path d="M-30 720Q250 685 295 900" fill="none" stroke="var(--rp-map-path)" strokeWidth="6" strokeDasharray="6 7" />
    </svg>
    <div className="rp-preview-notice"><span /><strong>지도 배치 미리보기</strong><small>대표 예시 가게 · 실제 위치가 아니에요</small></div>
    <div className="rp-preview-pins">
      {previewStores.map((store, index) => {
        const [left, top] = PREVIEW_POINTS[index];
        return <button key={store.id} type="button" className={'rp-preview-pin' + (selectedId === store.id ? ' is-selected' : '')} style={{ left: left + '%', top: top + '%' }} onClick={() => onSelect(store.id)} aria-label={store.name + ' 위치 선택'} aria-pressed={selectedId === store.id}>
          <span><svg viewBox="0 0 36 46" aria-hidden="true"><path d="M18 45C11 35 3 28 3 17a15 15 0 0 1 30 0c0 11-8 18-15 28Z" /><circle cx="18" cy="17" r="5.5" /></svg></span>
          {(selectedId === store.id || index === 0 || index === 2) && <strong>{store.name}</strong>}
        </button>;
      })}
    </div>
  </div>;
}
