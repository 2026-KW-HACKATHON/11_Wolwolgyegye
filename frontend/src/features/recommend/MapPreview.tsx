import { useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { Store } from '../../core/types/place';
import Icon from '../../shared/Icon';
import MapControls from './MapControls';
import { WOLGYE_MAP } from './mapArea';

const PREVIEW_POINTS = [[25, 33], [72, 36], [48, 46], [22, 56], [77, 58], [48, 68]];
const ZOOM_STEP = 1.4;
const MIN_SCALE = ZOOM_STEP ** (WOLGYE_MAP.defaultLevel - WOLGYE_MAP.maxLevel);
const MAX_SCALE = ZOOM_STEP ** (WOLGYE_MAP.defaultLevel - WOLGYE_MAP.minLevel);

type Point = { x: number; y: number };
type Gesture = { points: Point[]; scale: number; pan: Point };

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 로컬에서 SDK 키 없이 배치를 검토하는 도식. 실제 도로나 길찾기 지도가 아니다. */
export default function MapPreview({ stores, selectedId, onSelect }: {
  stores: Store[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const level = Math.round(WOLGYE_MAP.defaultLevel - Math.log(scale) / Math.log(ZOOM_STEP));
  const previewStores = stores.slice(0, PREVIEW_POINTS.length);
  const selectedStore = stores.find((store) => store.id === selectedId);
  if (selectedStore && !previewStores.some((store) => store.id === selectedId)) previewStores[previewStores.length - 1] = selectedStore;
  function startGesture() {
    gesture.current = { points: [...pointers.current.values()], scale, pan };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    startGesture();
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = [...pointers.current.values()];
    const initial = gesture.current.points;
    if (current.length === 1 && initial.length === 1) {
      setPan({ x: gesture.current.pan.x + current[0].x - initial[0].x, y: gesture.current.pan.y + current[0].y - initial[0].y });
    } else if (current.length === 2 && initial.length === 2) {
      setScale(clampScale(gesture.current.scale * distance(current[0], current[1]) / Math.max(1, distance(initial[0], initial[1]))));
      const from = midpoint(initial[0], initial[1]);
      const to = midpoint(current[0], current[1]);
      setPan({ x: gesture.current.pan.x + to.x - from.x, y: gesture.current.pan.y + to.y - from.y });
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    startGesture();
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setScale((previous) => clampScale(previous * Math.exp(-event.deltaY * 0.002)));
  }

  function resetView() {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }

  return <div className="rp-map-preview" aria-label="예시 가게 배치 미리보기"
    onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
    onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onWheel={handleWheel}>
    <div className="rp-preview-scene" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
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
      <div className="rp-preview-pins">
        {previewStores.map((store, index) => <button key={store.id} type="button" className={'rp-preview-pin' + (selectedId === store.id ? ' is-selected' : '')} style={{ left: PREVIEW_POINTS[index][0] + '%', top: PREVIEW_POINTS[index][1] + '%' }} onClick={() => onSelect(store.id)} aria-label={store.name + ' 위치 선택'} aria-pressed={selectedId === store.id}>
          <span><Icon name={store.supports['space-rental'] ? 'house' : store.supports['oneday-class'] ? 'palette' : 'storefront'} /></span>
          {(selectedId === store.id || index === 0 || index === 2) && <strong>{store.name}</strong>}
        </button>)}
      </div>
    </div>
    <MapControls level={level} onZoom={(direction) => setScale((previous) => clampScale(previous * (direction === -1 ? ZOOM_STEP : 1 / ZOOM_STEP)))} onReset={resetView} preview />
  </div>;
}
