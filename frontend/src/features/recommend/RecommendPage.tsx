import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useUserSession } from '../../shared/session/UserSessionContext';
import Icon from '../../shared/Icon';
import HomeScreen from './HomeScreen';
import NearbyScreen from './NearbyScreen';
import './recommend.css';

type SheetView = 'feed' | 'map';
type Drag = { y: number; top: number; min: number; max: number };

/** 기존 추천 카테고리 안에서 지도와 주민 피드의 상태를 연결한다. */
export default function RecommendPage() {
  const [view, setView] = useState<SheetView>('feed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragTop, setDragTop] = useState<number | null>(null);
  const { userName } = useUserSession();
  const shell = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);

  useEffect(() => { if (userName) setView('feed'); }, [userName]);

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!shell.current || !sheet.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const css = getComputedStyle(shell.current);
    const min = parseFloat(css.getPropertyValue('--rp-feed-top'));
    const max = Math.max(min, shell.current.clientHeight - parseFloat(css.getPropertyValue('--rp-map-peek')));
    drag.current = { y: event.clientY, top: sheet.current.offsetTop, min, max };
    dragged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const delta = event.clientY - drag.current.y;
    if (Math.abs(delta) > 6) dragged.current = true;
    if (dragged.current) setDragTop(Math.min(drag.current.max, Math.max(drag.current.min, drag.current.top + delta)));
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const delta = event.clientY - drag.current.y;
    if (dragged.current) {
      const middle = (drag.current.min + drag.current.max) / 2;
      setView(Math.abs(delta) > 48 ? (delta > 0 ? 'map' : 'feed') : (drag.current.top + delta > middle ? 'map' : 'feed'));
    }
    drag.current = null;
    setDragTop(null);
  }

  function toggleByClick() {
    if (dragged.current) { dragged.current = false; return; }
    setView((previous) => previous === 'feed' ? 'map' : 'feed');
  }

  function showStore(id: string) { setSelectedId(id); setView('map'); }

  return <div ref={shell} className="rp-shell" data-view={view} data-dragging={dragTop !== null} style={{ '--rp-drag-top': dragTop === null ? undefined : dragTop + 'px' } as CSSProperties}>
    <div className="rp-map-layer"><NearbyScreen selectedId={selectedId} onSelect={setSelectedId} onShowMap={() => setView('map')} /></div>
    <section ref={sheet} className="rp-sheet" aria-label="동네 사장님 피드">
      <button type="button" className="rp-sheet-grip" aria-expanded={view === 'feed'} aria-controls="rp-feed-content"
        aria-label={view === 'feed' ? '손잡이를 아래로 내려 지도 크게 보기' : '손잡이를 위로 올려 피드 펼치기'}
        onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}
        onPointerCancel={() => { drag.current = null; setDragTop(null); }}
        onClick={toggleByClick}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setView(event.key === 'ArrowDown' ? 'map' : 'feed');
          }
        }}>
        <span className="rp-sheet-handle" /><span>{view === 'feed' ? '내리면 동네 지도가 보여요' : '올리면 동네 소식이 보여요'}</span>
      </button>
      <div id="rp-feed-content" className="rp-sheet-content" tabIndex={0} hidden={view === 'map'}>
        <HomeScreen onShowNearby={() => setView('map')} onShowStore={showStore} />
      </div>
      {view === 'map' && <button type="button" className="rp-sheet-peek" onClick={() => setView('feed')}><span className="rp-peek-icon"><Icon name="storefront" /></span><span><strong>골목마다 새로운 이야기</strong><small>사장님 소식 이어서 보기</small></span><Icon name="chevronUp" /></button>}
    </section>
  </div>;
}
