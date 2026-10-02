import { useEffect, useRef, useState } from 'react';
import type { Store } from '../../core/types/place';
import { distanceMeters } from '../../core/utils/geo';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import MapPreview from './MapPreview';
import MapControls from './MapControls';
import { clampMapLevel, WOLGYE_MAP } from './mapArea';

interface KakaoLatLng { getLat(): number; getLng(): number }
interface KakaoMapInstance {
  panTo(position: KakaoLatLng): void;
  jump(position: KakaoLatLng, level: number, options?: { animate: boolean }): void;
  getCenter(): KakaoLatLng;
  setLevel(level: number, options?: { animate: boolean }): void;
  getLevel(): number;
  setMinLevel(level: number): void;
  setMaxLevel(level: number): void;
  setDraggable(draggable: boolean): void;
  setZoomable(zoomable: boolean): void;
  relayout(): void;
}
interface KakaoMarkerInstance { setMap(map: KakaoMapInstance | null): void }
interface KakaoMaps {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (element: HTMLElement, options: { center: KakaoLatLng; level: number; draggable: boolean; scrollwheel: boolean }) => KakaoMapInstance;
  Marker: new (options: { position: KakaoLatLng; title: string; clickable: boolean }) => KakaoMarkerInstance;
  event: {
    addListener(target: KakaoMarkerInstance | KakaoMapInstance, event: string, listener: () => void): void;
    removeListener(target: KakaoMarkerInstance | KakaoMapInstance, event: string, listener: () => void): void;
  };
}
declare global { interface Window { kakao?: { maps: KakaoMaps } } }

const key = import.meta.env.VITE_KAKAO_MAP_KEY?.trim();
let sdkPromise: Promise<KakaoMaps> | undefined;

function loadKakaoMaps(): Promise<KakaoMaps> {
  if (window.kakao?.maps) return new Promise((resolve) => window.kakao!.maps.load(() => resolve(window.kakao!.maps)));
  if (!key) return Promise.reject(new Error('VITE_KAKAO_MAP_KEY가 설정되지 않았어요.'));
  if (!sdkPromise) {
    sdkPromise = new Promise<KakaoMaps>((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => reject(new Error('카카오맵 연결 시간이 초과됐어요.')), 12000);
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
      script.async = true;
      script.onload = () => {
        if (!window.kakao?.maps) { window.clearTimeout(timeout); reject(new Error('카카오맵을 불러오지 못했어요.')); return; }
        window.kakao.maps.load(() => { window.clearTimeout(timeout); resolve(window.kakao!.maps); });
      };
      script.onerror = () => { window.clearTimeout(timeout); reject(new Error('카카오맵 연결에 실패했어요. JavaScript SDK 도메인을 확인해 주세요.')); };
      document.head.appendChild(script);
    }).catch((error: unknown) => { sdkPromise = undefined; throw error; });
  }
  return sdkPromise;
}

export default function KakaoMap({ stores, selectedId, onSelect }: { stores: Store[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markersRef = useRef<KakaoMarkerInstance[]>([]);
  const sdkRef = useRef<KakaoMaps | null>(null);
  const onSelectRef = useRef(onSelect);
  const active = usePageActive();
  const [visible, setVisible] = useState(false);
  const [level, setLevel] = useState<number>(WOLGYE_MAP.defaultLevel);
  const [away, setAway] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(key ? 'loading' : 'error');
  const [message, setMessage] = useState(key ? '' : '지도 키가 아직 연결되지 않았어요. VITE_KAKAO_MAP_KEY를 설정해 주세요.');

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !active || !key) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (!visible || !active || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    void loadKakaoMaps().then((maps) => {
      if (cancelled || !containerRef.current) return;
      sdkRef.current = maps;
      const map = new maps.Map(containerRef.current, {
        center: new maps.LatLng(WOLGYE_MAP.center.lat, WOLGYE_MAP.center.lng),
        level: WOLGYE_MAP.defaultLevel,
        draggable: true,
        scrollwheel: true,
      });
      map.setMinLevel(WOLGYE_MAP.minLevel);
      map.setMaxLevel(WOLGYE_MAP.maxLevel);
      map.setDraggable(true);
      map.setZoomable(true); // 마우스 휠과 휴대폰 두 손가락 확대/축소를 허용한다.
      mapRef.current = map;
      setStatus('ready');
    }).catch((error: unknown) => {
      if (cancelled) return;
      setMessage(error instanceof Error ? error.message : '지도를 불러오지 못했어요.');
      setStatus('error');
    });
    return () => { cancelled = true; };
  }, [visible, active]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // KeepAlive로 화면을 숨겼다가 다시 열어도 지도 입력 상태를 확실히 복구한다.
    map.setDraggable(active);
    map.setZoomable(active);
    if (active) map.relayout();
  }, [active, status]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = sdkRef.current;
    if (!map || !maps || status !== 'ready') return;
    const syncView = () => {
      setLevel(map.getLevel());
      const center = map.getCenter();
      setAway(distanceMeters(WOLGYE_MAP.center, { lat: center.getLat(), lng: center.getLng() }) > WOLGYE_MAP.returnHintMeters);
    };
    maps.event.addListener(map, 'zoom_changed', syncView);
    maps.event.addListener(map, 'idle', syncView);
    syncView();
    return () => {
      maps.event.removeListener(map, 'zoom_changed', syncView);
      maps.event.removeListener(map, 'idle', syncView);
    };
  }, [status]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = sdkRef.current;
    if (!map || !maps || status !== 'ready') return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    const listeners: Array<{ marker: KakaoMarkerInstance; click: () => void }> = [];
    markersRef.current = stores.map((store) => {
      const marker = new maps.Marker({ position: new maps.LatLng(store.location.lat, store.location.lng), title: store.name, clickable: true });
      marker.setMap(map);
      const click = () => onSelectRef.current(store.id);
      maps.event.addListener(marker, 'click', click);
      listeners.push({ marker, click });
      return marker;
    });
    return () => {
      listeners.forEach(({ marker, click }) => {
        maps.event.removeListener(marker, 'click', click);
        marker.setMap(null);
      });
      markersRef.current = [];
    };
  }, [stores, status]);

  useEffect(() => {
    const store = stores.find((item) => item.id === selectedId);
    if (store && mapRef.current && sdkRef.current) mapRef.current.panTo(new sdkRef.current.LatLng(store.location.lat, store.location.lng));
  }, [selectedId, stores, status]);

  useEffect(() => {
    if (!active || !mapRef.current || !containerRef.current) return;
    const map = mapRef.current;
    const observer = new ResizeObserver(() => map.relayout());
    observer.observe(containerRef.current);
    map.relayout();
    return () => observer.disconnect();
  }, [active, status]);

  function zoom(direction: -1 | 1) {
    const map = mapRef.current;
    if (!map) return;
    const next = clampMapLevel(map.getLevel() + direction);
    map.setLevel(next, { animate: true });
    setLevel(next);
  }

  function resetView() {
    const map = mapRef.current;
    const maps = sdkRef.current;
    if (!map || !maps) return;
    map.jump(new maps.LatLng(WOLGYE_MAP.center.lat, WOLGYE_MAP.center.lng), WOLGYE_MAP.defaultLevel, { animate: true });
    setLevel(WOLGYE_MAP.defaultLevel);
    setAway(false);
  }

  if (import.meta.env.DEV && !key) return <MapPreview stores={stores} selectedId={selectedId} onSelect={onSelect} />;

  return <div className="rp-map-frame">
    <div ref={containerRef} className="rp-map-canvas" role="img" aria-label="월계1동 주변 가게가 표시된 카카오 지도" />
    {status !== 'ready' && <div className="rp-map-state" role={status === 'error' ? 'alert' : 'status'}><strong>{status === 'loading' ? '동네 지도를 불러오는 중' : '지도를 잠시 불러오지 못했어요'}</strong><span>{status === 'error' ? '잠시 후 다시 방문해 주세요. 동네 소식은 계속 볼 수 있어요.' : '잠시만 기다려 주세요.'}</span>{import.meta.env.DEV && status === 'error' && <small>{message}</small>}</div>}
    {status === 'ready' && <MapControls level={level} onZoom={zoom} onReset={resetView} away={away} />}
  </div>;
}
