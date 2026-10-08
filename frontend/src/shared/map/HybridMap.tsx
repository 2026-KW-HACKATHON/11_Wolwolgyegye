import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { GeoPoint } from '../../core/types/place';
import { useMarkerStyle } from '../../core/map/markerStyle';
import MainMap, { type MainMapHandle, type MainMapProps, type MapInsets } from './MainMap';

const Map3D = lazy(() => import('./Map3D'));

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

interface LastCenter {
  point: GeoPoint;
  insets: MapInsets;
  minZoom?: number;
}

const MODE_STORAGE_KEY = 'wol-map-mode-v1';
type MapMode = '2d' | '3d';

function initialMode(): MapMode {
  try {
    const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === '2d') return '2d';
    if (saved === '3d' && canUseWebGL()) return '3d';
  } catch { /* 기본값 사용 */ }
  return canUseWebGL() ? '3d' : '2d';
}

/** 첫 접속은 3D 지도. 사용자가 고른 2D/3D 모드와 가게 핀 모양은 이 기기에 저장한다. */
const HybridMap = forwardRef<MainMapHandle, MainMapProps>(function HybridMap(props, ref) {
  const [mode, setMode] = useState<MapMode>(initialMode);
  const markerStyle = useMarkerStyle();
  const mapRef = useRef<MainMapHandle | null>(null);
  const lastCenterRef = useRef<LastCenter | null>(null);
  const myLocationRef = useRef<GeoPoint | null>(null);

  useImperativeHandle(ref, () => ({
    centerOn(point, insets, minZoom) {
      lastCenterRef.current = { point, insets, minZoom };
      return mapRef.current?.centerOn(point, insets, minZoom) ?? false;
    },
    showMyLocation(point) {
      myLocationRef.current = point;
      mapRef.current?.showMyLocation(point);
    },
  }), []);

  useEffect(() => {
    let frame = 0;
    let attempts = 0;
    const restore = () => {
      const current = mapRef.current;
      const center = lastCenterRef.current;
      if (current) {
        if (myLocationRef.current) current.showMyLocation(myLocationRef.current);
        if (!center || current.centerOn(center.point, center.insets, center.minZoom)) return;
      }
      if (attempts++ < 90) frame = requestAnimationFrame(restore);
    };
    frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  const toggleMode = () => {
    if (mode === '2d' && !canUseWebGL()) {
      window.alert('이 기기에서는 3D 지도를 사용할 수 없어요. 2D 지도를 이용해 주세요.');
      return;
    }
    const next = mode === '2d' ? '3d' : '2d';
    setMode(next);
    try { window.localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* 이번 실행에서만 유지 */ }
  };

  return (
    <div className="mm-hybrid" data-map-mode={mode}>
      {mode === '2d' ? (
        <MainMap key={`2d-${markerStyle}`} ref={mapRef} {...props} markerStyle={markerStyle} />
      ) : (
        <Suspense fallback={<div className="mm-state" role="status">3D 지도를 준비하는 중…</div>}>
          <Map3D key={`3d-${markerStyle}`} ref={mapRef} {...props} markerStyle={markerStyle} />
        </Suspense>
      )}
      <button
        className="mm-mode-toggle"
        type="button"
        aria-label={mode === '2d' ? '3D 지도 켜기' : '2D 지도 켜기'}
        aria-pressed={mode === '3d'}
        onClick={toggleMode}
      >
        <strong>{mode === '2d' ? '3D' : '2D'}</strong>
        <span>{mode === '2d' ? '입체 지도' : '평면 지도'}</span>
      </button>
    </div>
  );
});

export default HybridMap;
