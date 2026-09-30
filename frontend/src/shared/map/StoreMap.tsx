import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GeoPoint, Store } from '../../core/types/place';
import { distanceMeters } from '../../core/utils/geo';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import ExtraIcon from '../ExtraIcon';
import { KAKAO_MAP_KEY, kakaoMapLink, loadKakaoMaps, type KMap, type KMaps, type KMarker, type KOverlay } from './kakaoSdk';
import './StoreMap.css';

/**
 * 가게 한 곳의 위치를 보여주는 작은 지도. (스탬프·제휴 가게 상세에서 사용)
 *
 * - VITE_KAKAO_MAP_KEY 가 있으면 실제 카카오맵에 가게 마커를 찍는다.
 * - 키가 없거나 SDK 를 못 불러오면 "위치 약도"를 그린다. 약도는 기준점과 가게 좌표로
 *   방향·직선거리만 정확히 계산한 그림이며, 도로·건물은 그리지 않는다. (실제 지도로 오해하지 않도록 표시)
 * - 오른쪽 아래 버튼은 키가 없어도 카카오맵 웹으로 열린다.
 */
interface StoreMapProps {
  store: Store;
  /** 약도·거리 계산 기준점 (현재는 예시 기준점) */
  origin: GeoPoint;
  originLabel?: string;
  /** 예시 좌표면 "예시 위치"로 표시 */
  demo?: boolean;
  className?: string;
}

type Mode = 'loading' | 'kakao' | 'sketch';

export default function StoreMap({ store, origin, originLabel = '기준점', demo = true, className }: StoreMapProps) {
  const active = usePageActive();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KMap | null>(null);
  const sdkRef = useRef<KMaps | null>(null);
  const [mode, setMode] = useState<Mode>(KAKAO_MAP_KEY ? 'loading' : 'sketch');
  const [failed, setFailed] = useState(false);
  // 숨겨진 탭(KeepAlive)에서는 만들지 않고, 처음 보일 때 한 번만 만든다
  const [armed, setArmed] = useState(active);
  useEffect(() => { if (active) setArmed(true); }, [active]);
  const { lat, lng } = store.location;
  const link = kakaoMapLink(store.name, lat, lng);

  // 1) 실제 카카오맵 만들기
  useEffect(() => {
    if (!KAKAO_MAP_KEY || !armed) return;
    let cancelled = false;
    let marker: KMarker | null = null;
    let overlay: KOverlay | null = null;
    loadKakaoMaps().then((maps) => {
      const node = boxRef.current;
      if (cancelled || !node) return;
      sdkRef.current = maps;
      node.replaceChildren(); // 같은 칸에 다른 가게 지도를 다시 그릴 때 이전 지도를 비운다
      const center = new maps.LatLng(lat, lng);
      const map = new maps.Map(node, { center, level: 3, scrollwheel: false });
      marker = new maps.Marker({ position: center, title: store.name });
      marker.setMap(map);
      if (maps.CustomOverlay) {
        const label = document.createElement('span');
        label.className = 'smap-kakao-label';
        label.textContent = store.name; // textContent 라서 가게 이름이 HTML 로 해석되지 않는다
        overlay = new maps.CustomOverlay({ position: center, content: label, yAnchor: 2.6 });
        overlay.setMap(map);
      }
      if (maps.ZoomControl && maps.ControlPosition && map.addControl) map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
      mapRef.current = map;
      setMode('kakao');
    }).catch(() => {
      if (cancelled) return;
      setFailed(true);
      setMode('sketch');
    });
    return () => {
      cancelled = true;
      marker?.setMap(null);
      overlay?.setMap(null);
      mapRef.current = null;
    };
  }, [armed, lat, lng, store.name]);

  // 2) 펼쳐지거나 크기가 바뀌면 다시 맞추고 가게를 가운데로
  useEffect(() => {
    const node = boxRef.current;
    if (mode !== 'kakao' || !node) return;
    const recenter = () => {
      const map = mapRef.current;
      const maps = sdkRef.current;
      if (!map || !maps) return;
      map.relayout();
      map.setCenter(new maps.LatLng(lat, lng));
    };
    const observer = new ResizeObserver(recenter);
    observer.observe(node);
    recenter();
    return () => observer.disconnect();
  }, [mode, lat, lng, active]);

  return (
    <figure className={`smap${className ? ` ${className}` : ''}`} data-mode={mode}>
      <div className="smap-box">
        {KAKAO_MAP_KEY && !failed && (
          <div ref={boxRef} className="smap-kakao" role="img" aria-label={`${store.name} 위치가 표시된 카카오 지도`} />
        )}
        {mode === 'loading' && <div className="smap-state" role="status"><span className="smap-spinner" aria-hidden="true" />지도를 불러오는 중…</div>}
        {mode === 'sketch' && <Sketch store={store} origin={origin} originLabel={originLabel} />}
      </div>
      <div className="smap-foot">
        <figcaption className="smap-caption">
          {mode === 'sketch'
            ? <>{failed ? '실제 지도를 불러오지 못해 ' : ''}<b>위치 약도</b> · 방향과 직선거리만 표시했어요</>
            : <>{demo ? '예시 좌표에 찍은 위치예요. 실제 가게 위치가 아니에요.' : '가게 위치'}</>}
        </figcaption>
        {link && (
          <a className="smap-open" href={link} target="_blank" rel="noopener noreferrer" aria-label={`${store.name} 위치를 카카오맵에서 크게 보기 (새 창)`}>
            카카오맵에서 보기 <ExtraIcon name="external" />
          </a>
        )}
      </div>
    </figure>
  );
}

/* ---------------------------------------------------------------------------
   위치 약도: 기준점(0,0)에서 가게까지 동·북 방향 거리(m)를 구해 그대로 축소해서 그린다.
   그림 크기를 실제 칸 크기(px)에 맞춰서, 어떤 비율의 칸에서도 핀·이름이 잘리지 않는다.
   --------------------------------------------------------------------------- */
const NICE = [20, 50, 100, 200, 250, 500, 1000, 2000];

function Sketch({ store, origin, originLabel }: { store: Store; origin: GeoPoint; originLabel: string }) {
  const gridId = `smap-grid-${useId().replace(/:/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 400, h: 240 });
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { w: W, h: H } = size;
  const g = useMemo(() => {
    const rad = Math.PI / 180;
    const R = 6_371_000;
    const padX = Math.min(96, W * 0.24);
    const padTop = 52;
    const padBottom = 40;
    const east = (store.location.lng - origin.lng) * rad * R * Math.cos(origin.lat * rad);
    const north = (store.location.lat - origin.lat) * rad * R;
    const sx = (W - padX * 2) / Math.max(Math.abs(east), 1);
    const sy = (H - padTop - padBottom) / Math.max(Math.abs(north), 1);
    const scale = Math.min(sx, sy, 0.9); // 아주 가까워도 과하게 확대하지 않는다
    const midX = W / 2;
    const midY = padTop + (H - padTop - padBottom) / 2;
    const o = { x: midX - (east * scale) / 2, y: midY + (north * scale) / 2 };
    const s = { x: o.x + east * scale, y: o.y - north * scale };
    const meters = distanceMeters(origin, store.location);
    const bar = NICE.find((n) => n * scale >= 44) ?? NICE[NICE.length - 1];
    const bearing = (Math.atan2(east, north) / rad + 360) % 360;
    return { o, s, meters, bar, barPx: bar * scale, dir: compass(bearing) };
  }, [store.location, origin, W, H]);

  const label = g.meters < 1000 ? `${Math.round(g.meters / 10) * 10}m` : `${(g.meters / 1000).toFixed(1)}km`;
  const nameRight = g.s.x < W - 140; // 오른쪽 공간이 모자라면 이름을 핀 왼쪽에
  return (
    <svg ref={svgRef} className="smap-sketch" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
      aria-label={`위치 약도: ${store.name}은(는) ${originLabel}에서 ${g.dir}쪽으로 직선 ${label} 떨어져 있어요.`}>
      <defs>
        <pattern id={gridId} width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" className="smap-grid-line" />
        </pattern>
      </defs>
      <rect width={W} height={H} className="smap-ground" />
      <rect width={W} height={H} fill={`url(#${gridId})`} />
      <circle cx={g.o.x} cy={g.o.y} r={g.barPx * 2} className="smap-ring" />
      <line x1={g.o.x} y1={g.o.y} x2={g.s.x} y2={g.s.y} className="smap-route" />
      <g transform={`translate(${(g.o.x + g.s.x) / 2} ${(g.o.y + g.s.y) / 2})`}>
        <rect x="-36" y="-12" width="72" height="24" rx="12" className="smap-dist-bg" />
        <text textAnchor="middle" y="4.5" className="smap-dist">직선 {label}</text>
      </g>
      <g transform={`translate(${g.o.x} ${g.o.y})`}>
        <circle r="11" className="smap-origin-halo" />
        <circle r="5.5" className="smap-origin" />
        <text y="26" textAnchor="middle" className="smap-origin-text">{originLabel}</text>
      </g>
      <g transform={`translate(${g.s.x} ${g.s.y})`}>
        <path d="M0 0c-7-9-11-14-11-19a11 11 0 0 1 22 0c0 5-4 10-11 19Z" className="smap-pin" />
        <circle cy="-19" r="4" className="smap-pin-dot" />
        <text x={nameRight ? 16 : -16} y="-15" textAnchor={nameRight ? 'start' : 'end'} className="smap-name">{store.name}</text>
      </g>
      <g transform={`translate(${W - 24} 28)`} className="smap-north">
        <path d="M0-14 6 4 0 0-6 4Z" />
        <text y="18" textAnchor="middle">N</text>
      </g>
      <g transform={`translate(14 ${H - 16})`} className="smap-scale">
        <path d={`M0 -4V0H${g.barPx}V-4`} />
        <text x={g.barPx + 6} y="1">{g.bar >= 1000 ? `${g.bar / 1000}km` : `${g.bar}m`}</text>
      </g>
    </svg>
  );
}

/** '북동쪽 · 직선 240m' 같은 방향·거리 문구 (지도 옆 글 설명용) */
export function directionText(from: GeoPoint, to: GeoPoint): string {
  const rad = Math.PI / 180;
  const east = (to.lng - from.lng) * Math.cos(from.lat * rad);
  const north = to.lat - from.lat;
  const meters = distanceMeters(from, to);
  const dist = meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`;
  return `${compass((Math.atan2(east, north) / rad + 360) % 360)}쪽 · 직선 ${dist}`;
}

function compass(deg: number): string {
  const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  return names[Math.round(deg / 45) % 8];
}
