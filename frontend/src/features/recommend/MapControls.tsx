import { WOLGYE_MAP } from './mapArea';

interface Props {
  level: number;
  onZoom: (direction: -1 | 1) => void;
  onReset: () => void;
  away?: boolean;
  preview?: boolean;
}

/** 큰 터치 영역과 명시적인 이름. 확대/축소 한계에서도 동네 복귀는 항상 가능하다. */
export default function MapControls({ level, onZoom, onReset, away = false, preview = false }: Props) {
  return <div className="rp-map-controls" role="group" aria-label="지도 보기 조절">
    <div className="rp-map-controls-row">
      <div className="rp-map-zoom" role="group" aria-label="지도 확대 및 축소">
        <button type="button" onClick={() => onZoom(-1)} disabled={level <= WOLGYE_MAP.minLevel} aria-label="지도 확대" title="지도 확대"><span aria-hidden="true">＋</span></button>
        <button type="button" onClick={() => onZoom(1)} disabled={level >= WOLGYE_MAP.maxLevel} aria-label="지도 축소" title="지도 축소"><span aria-hidden="true">−</span></button>
      </div>
      <button type="button" className={'rp-map-home' + (away ? ' is-away' : '')} onClick={onReset} aria-label="월계1동 중심과 기본 확대 크기로 돌아가기">
        <span aria-hidden="true">⌂</span><span>{away ? '월계1동으로 복귀' : '월계1동으로'}</span>
      </button>
    </div>
    <p className="rp-map-control-help" aria-live="polite">{preview ? '배치 미리보기 · 실제 지도 아님' : away ? '동네에서 멀어졌어요. 버튼을 눌러 돌아오세요.' : '두 손가락으로도 확대·축소할 수 있어요'}</p>
  </div>;
}
