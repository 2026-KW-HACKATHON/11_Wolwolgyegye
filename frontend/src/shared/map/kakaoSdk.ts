/**
 * 카카오맵 JavaScript SDK 로더 (가게 한 곳을 보여주는 작은 지도용).
 *
 * - 홈 지도(features/recommend/KakaoMap.tsx)와 같은 키(VITE_KAKAO_MAP_KEY)를 쓴다.
 * - 홈 화면이 이미 SDK <script> 를 넣었으면 새로 넣지 않고 그 스크립트를 기다린다. (중복 로딩 방지)
 * - window.kakao 전역 타입은 홈 지도 파일에 이미 선언돼 있어서, 여기서는 다시 선언하지 않고 필요한 모양만 따로 적는다.
 */

export interface KLatLng { getLat(): number; getLng(): number }
export interface KMap {
  setCenter(position: KLatLng): void;
  relayout(): void;
  setLevel?(level: number): void;
  addControl?(control: unknown, position: unknown): void;
}
export interface KMarker { setMap(map: KMap | null): void }
export interface KOverlay { setMap(map: KMap | null): void }
export interface KMaps {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KLatLng;
  Map: new (element: HTMLElement, options: { center: KLatLng; level: number; scrollwheel?: boolean; draggable?: boolean }) => KMap;
  Marker: new (options: { position: KLatLng; title?: string; clickable?: boolean }) => KMarker;
  CustomOverlay?: new (options: { position: KLatLng; content: HTMLElement | string; yAnchor?: number; xAnchor?: number }) => KOverlay;
  ZoomControl?: new () => unknown;
  ControlPosition?: { RIGHT: unknown };
}

const SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js';
export const KAKAO_MAP_KEY: string = import.meta.env.VITE_KAKAO_MAP_KEY?.trim() ?? '';

function kakaoGlobal(): { maps: KMaps } | undefined {
  return (window as unknown as { kakao?: { maps: KMaps } }).kakao;
}

/** SDK 가 준비되면 kakao.maps 를 돌려준다. 키가 없으면 바로 실패한다 */
let pending: Promise<KMaps> | undefined;
export function loadKakaoMaps(): Promise<KMaps> {
  const ready = kakaoGlobal();
  if (ready?.maps) return new Promise((resolve) => ready.maps.load(() => resolve(ready.maps)));
  if (!KAKAO_MAP_KEY) return Promise.reject(new Error('NO_KEY'));
  if (pending) return pending;

  pending = new Promise<KMaps>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SDK_URL}"]`);
    const script = existing ?? document.createElement('script');
    const timer = window.setTimeout(() => reject(new Error('TIMEOUT')), 12000);
    script.addEventListener('load', () => {
      const kakao = kakaoGlobal();
      if (!kakao?.maps) { window.clearTimeout(timer); reject(new Error('SDK_MISSING')); return; }
      kakao.maps.load(() => { window.clearTimeout(timer); resolve(kakao.maps); });
    }, { once: true });
    script.addEventListener('error', () => { window.clearTimeout(timer); reject(new Error('LOAD_FAILED')); }, { once: true });
    if (!existing) {
      script.src = `${SDK_URL}?appkey=${encodeURIComponent(KAKAO_MAP_KEY)}&autoload=false`;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => { pending = undefined; throw error; });
  return pending;
}

/** 카카오맵 웹에서 해당 좌표를 여는 링크 (SDK 키 없이도 동작) */
export function kakaoMapLink(name: string, lat: number, lng: number, mode: 'map' | 'to' = 'map'): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `https://map.kakao.com/link/${mode}/${encodeURIComponent(name)},${lat},${lng}`;
}
