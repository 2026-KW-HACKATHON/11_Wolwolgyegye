import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { GeoPoint } from '../../core/types/place';
import type { MainMapHandle, MainMapProps, MapInsets } from './MainMap';
import Map2D from './Map2D';
import './MainMap.css';

const Map3D = lazy(() => import('./Map3D'));
/** WebGL 을 못 쓰는 기기에서만 쓰는 Leaflet(Canvas) 2D 지도 */
const MainMap = lazy(() => import('./MainMap'));

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

/**
 * 기본은 MapLibre(WebGL) 평면 지도이며, 사용자가 고를 때만 3D 청크와 건물 데이터를 불러온다.
 * WebGL 을 못 쓰는 기기에서는 Leaflet 평면 지도를 쓰고 3D 버튼을 숨긴다.
 */
const HybridMap = forwardRef<MainMapHandle, MainMapProps>(function HybridMap(props, ref) {
  const [webgl] = useState(canUseWebGL);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
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

  const toggleMode = () => setMode((current) => current === '2d' ? '3d' : '2d');

  return (
    <div className="mm-hybrid" data-map-mode={mode}>
      {!webgl ? (
        <Suspense fallback={<div className="mm-state" role="status">지도를 불러오는 중…</div>}>
          <MainMap ref={mapRef} {...props} />
        </Suspense>
      ) : mode === '2d' ? (
        <Map2D ref={mapRef} {...props} />
      ) : (
        <Suspense fallback={<div className="mm-state" role="status">3D 지도를 준비하는 중…</div>}>
          <Map3D ref={mapRef} {...props} />
        </Suspense>
      )}
      {webgl && <button
        className="mm-mode-toggle"
        type="button"
        aria-label={mode === '2d' ? '3D 지도 켜기' : '2D 지도 켜기'}
        aria-pressed={mode === '3d'}
        onClick={toggleMode}
      >
        <strong>{mode === '2d' ? '3D' : '2D'}</strong>
        <span>{mode === '2d' ? '입체 지도' : '평면 지도'}</span>
      </button>}
    </div>
  );
});

export default HybridMap;
