import { useEffect, useRef, useState } from 'react';
import type { Store } from '../../core/types/place';
import { WOLGYE_CENTER } from '../../core/location/wolgye';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import MapPreview from './MapPreview';
import type { MapStoreGroup } from './mapStoreGroups';

interface KakaoLatLng { getLat(): number; getLng(): number }
interface KakaoMapInstance { setCenter(position: KakaoLatLng): void; relayout(): void }
interface KakaoMarkerInstance { setMap(map: KakaoMapInstance | null): void }
interface KakaoMarkerImage { }
interface KakaoMarkerClusterer { addMarkers(markers: KakaoMarkerInstance[]): void; clear(): void }
interface KakaoMaps {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (element: HTMLElement, options: { center: KakaoLatLng; level: number; scrollwheel: boolean }) => KakaoMapInstance;
  Marker: new (options: { position: KakaoLatLng; title: string; clickable: boolean; image?: KakaoMarkerImage }) => KakaoMarkerInstance;
  MarkerImage: new (src: string, size: KakaoSize, options: { offset: KakaoPoint }) => KakaoMarkerImage;
  Size: new (width: number, height: number) => KakaoSize;
  Point: new (x: number, y: number) => KakaoPoint;
  MarkerClusterer?: new (options: { map: KakaoMapInstance; gridSize: number; averageCenter: boolean; minLevel: number }) => KakaoMarkerClusterer;
  event: { addListener(target: KakaoMarkerInstance, event: string, listener: () => void): void };
}
interface KakaoSize { }
interface KakaoPoint { }
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
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=clusterer`;
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

function groupMarkerImage(maps: KakaoMaps, count: number): KakaoMarkerImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="54" viewBox="0 0 48 54"><path d="M24 51 11 35a20 20 0 1 1 26 0Z" fill="#275b46" stroke="white" stroke-width="3"/><text x="24" y="29" text-anchor="middle" fill="white" font-family="sans-serif" font-size="16" font-weight="700">${count}</text></svg>`;
  return new maps.MarkerImage(`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, new maps.Size(48, 54), { offset: new maps.Point(24, 54) });
}

export default function KakaoMap({ stores, groups, selectedId, onSelect, onSelectGroup }: {
  stores: Store[]; groups: MapStoreGroup[]; selectedId: string | null;
  onSelect: (id: string) => void; onSelectGroup: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markersRef = useRef<KakaoMarkerInstance[]>([]);
  const clustererRef = useRef<KakaoMarkerClusterer | null>(null);
  const sdkRef = useRef<KakaoMaps | null>(null);
  const onSelectRef = useRef(onSelect);
  const onSelectGroupRef = useRef(onSelectGroup);
  const active = usePageActive();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(key ? 'loading' : 'error');
  const [message, setMessage] = useState(key ? '' : '지도 키가 아직 연결되지 않았어요. VITE_KAKAO_MAP_KEY를 설정해 주세요.');

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onSelectGroupRef.current = onSelectGroup; }, [onSelectGroup]);
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
      mapRef.current = new maps.Map(containerRef.current, { center: new maps.LatLng(WOLGYE_CENTER.lat, WOLGYE_CENTER.lng), level: 4, scrollwheel: false });
      if (maps.MarkerClusterer) clustererRef.current = new maps.MarkerClusterer({ map: mapRef.current, gridSize: 50, averageCenter: true, minLevel: 3 });
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
    const maps = sdkRef.current;
    if (!map || !maps || status !== 'ready') return;
    clustererRef.current?.clear();
    markersRef.current.forEach((marker) => marker.setMap(null));
    const images = new Map<number, KakaoMarkerImage>();
    markersRef.current = groups.map((group) => {
      const count = group.stores.length;
      if (count > 1 && !images.has(count)) images.set(count, groupMarkerImage(maps, count));
      const marker = new maps.Marker({
        position: new maps.LatLng(group.lat, group.lng),
        title: count > 1 ? `${group.address} · 가게 ${count}곳` : group.stores[0].name,
        clickable: true,
        ...(count > 1 ? { image: images.get(count) } : {}),
      });
      if (!clustererRef.current) marker.setMap(map);
      maps.event.addListener(marker, 'click', () => count > 1 ? onSelectGroupRef.current(group.key) : onSelectRef.current(group.stores[0].id));
      return marker;
    });
    clustererRef.current?.addMarkers(markersRef.current);
  }, [groups, status]);

  useEffect(() => {
    const store = stores.find((item) => item.id === selectedId);
    if (store && mapRef.current && sdkRef.current) mapRef.current.setCenter(new sdkRef.current.LatLng(store.location.lat, store.location.lng));
  }, [selectedId, stores, status]);

  useEffect(() => {
    if (!active || !mapRef.current || !containerRef.current) return;
    const map = mapRef.current;
    const observer = new ResizeObserver(() => map.relayout());
    observer.observe(containerRef.current);
    map.relayout();
    return () => observer.disconnect();
  }, [active, status]);

  if (import.meta.env.DEV && !key) return <MapPreview stores={stores} selectedId={selectedId} onSelect={onSelect} />;

  return <div className="rp-map-frame">
    <div ref={containerRef} className="rp-map-canvas" role="img" aria-label="월계1동 주변 가게가 표시된 카카오 지도" />
    {status !== 'ready' && <div className="rp-map-state" role={status === 'error' ? 'alert' : 'status'}><strong>{status === 'loading' ? '동네 지도를 불러오는 중' : '지도를 잠시 불러오지 못했어요'}</strong><span>{status === 'error' ? '잠시 후 다시 방문해 주세요. 동네 소식은 계속 볼 수 있어요.' : '잠시만 기다려 주세요.'}</span>{import.meta.env.DEV && status === 'error' && <small>{message}</small>}</div>}
    {status === 'ready' && <button type="button" className="rp-map-recenter" onClick={() => mapRef.current?.setCenter(new sdkRef.current!.LatLng(WOLGYE_CENTER.lat, WOLGYE_CENTER.lng))} aria-label="월계1동 기준점으로 이동">◎</button>}
  </div>;
}
