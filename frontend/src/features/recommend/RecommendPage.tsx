import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useUserSession } from '../../shared/session/UserSessionContext';
import HomeScreen from './HomeScreen';
import NearbyScreen from './NearbyScreen';
import './recommend.css';

type SheetView = 'feed' | 'map';

/** 지도 위에 피드를 겹친 홈. 손잡이를 내려 지도를, 올려 피드를 넓게 본다. */
export default function RecommendPage() {
  const [view, setView] = useState<SheetView>('feed');
  const { userName } = useUserSession();
  const startY = useRef<number | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    if (userName) setView('feed');
  }, [userName]);

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    startY.current = event.clientY;
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    if (startY.current === null) return;
    const distance = event.clientY - startY.current;
    startY.current = null;
    if (Math.abs(distance) < 48) return;
    dragged.current = true;
    setView(distance > 0 ? 'map' : 'feed');
  }

  function toggleByClick() {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setView((previous) => previous === 'feed' ? 'map' : 'feed');
  }

  return <div className="rp-shell" data-view={view}>
    <div className="rp-map-layer"><NearbyScreen /></div>
    <section className="rp-sheet" aria-label="동네 사장님 피드">
      <button
        type="button"
        className="rp-sheet-grip"
        aria-expanded={view === 'feed'}
        aria-controls="rp-feed-content"
        aria-label={view === 'feed' ? '손잡이를 아래로 내려 지도 크게 보기' : '손잡이를 위로 올려 피드 펼치기'}
        onPointerDown={beginDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => { startY.current = null; }}
        onClick={toggleByClick}
      >
        <span className="rp-sheet-handle" />
        <span>{view === 'feed' ? '아래로 내려 지도 보기' : '위로 올려 피드 보기'}</span>
      </button>
      <div id="rp-feed-content" className="rp-sheet-content" tabIndex={0}>
        <HomeScreen onShowNearby={() => setView('map')} />
      </div>
    </section>
  </div>;
}
