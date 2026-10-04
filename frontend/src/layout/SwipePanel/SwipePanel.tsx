import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import './SwipePanel.css';

/** 1차 탭 상태: 바에 붙어 닫힘 / 반쯤 열림 / 지도 영역 전체 */
export type PanelState = 'closed' | 'half' | 'full';

const ORDER: PanelState[] = ['closed', 'half', 'full'];

/** 닫혔을 때 카테고리 바에 붙어 보이는 손잡이 두께 (px) */
const PANEL_PEEK = 28;

/** 상태별로 지도 위에 드러나는 크기 (y 축이면 높이, x 축이면 폭) */
function visibleSize(state: PanelState, half: number, full: number): number {
  const peek = Math.min(PANEL_PEEK, full);
  if (state === 'closed') return peek;
  if (state === 'full') return full;
  return Math.max(peek, Math.min(half, full));
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface SwipePanelProps {
  id: string;
  /** y: 아래에서 위로 (세로 화면) / x: 오른쪽에서 왼쪽으로 (가로 화면) */
  axis: 'x' | 'y';
  state: PanelState;
  onStateChange: (state: PanelState) => void;
  /** 반쯤 열렸을 때 크기 (px) */
  half: number;
  /** 지도 영역 전체 크기 (px) */
  full: number;
  /** 지금 선택된 탭인지. 아니면 숨기기만 하고 내부 상태는 유지한다 */
  active: boolean;
  title: string;
  /** 드러난 크기가 바뀔 때마다 (드래그 중 포함) 알려준다. 지도 버튼 위치·가운데 맞추기에 쓴다 */
  onVisibleChange?: (size: number) => void;
  children: ReactNode;
}

/**
 * 지도 위로 끌어올리는 1차 탭.
 * 손잡이 줄을 끌어 크기를 바꾸고, 놓으면 가까운 단계(닫힘/반/전체)로 붙는다. 빠르게 튕기면 그 방향의 다음 단계로 간다.
 * 손잡이를 누르면 닫힘 <-> 반 으로 바뀐다.
 */
export default function SwipePanel({
  id, axis, state, onStateChange, half, full, active, title, onVisibleChange, children,
}: SwipePanelProps) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ pos: number; visible: number; time: number } | null>(null);
  const moved = useRef(false);
  const suppressClick = useRef(false);
  const reportRef = useRef(onVisibleChange);
  reportRef.current = onVisibleChange;

  const peek = Math.min(PANEL_PEEK, full);
  const visible = drag ?? visibleSize(state, half, full);

  useEffect(() => {
    if (active) reportRef.current?.(visible);
  }, [active, visible, axis]);

  const pointerPos = (event: PointerEvent) => (axis === 'y' ? event.clientY : event.clientX);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    start.current = { pos: pointerPos(event), visible: visibleSize(state, half, full), time: performance.now() };
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s) return;
    const delta = pointerPos(event) - s.pos;
    if (!moved.current && Math.abs(delta) < 6) return;
    moved.current = true;
    setDrag(clamp(s.visible - delta, peek, full));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    start.current = null;
    if (!s || !moved.current) return;
    moved.current = false;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    const delta = pointerPos(event) - s.pos;
    const current = clamp(s.visible - delta, peek, full);
    // 양수 = 여는 방향 (px/ms)
    const velocity = -delta / Math.max(1, performance.now() - s.time);
    const sizes = ORDER.map((st) => visibleSize(st, half, full));

    let next: PanelState;
    if (Math.abs(velocity) > 0.6) {
      next = velocity > 0
        ? ORDER.find((_, i) => sizes[i] > current + 1) ?? 'full'
        : [...ORDER].reverse().find((st) => visibleSize(st, half, full) < current - 1) ?? 'closed';
    } else {
      next = ORDER.reduce((best, st, i) => (Math.abs(sizes[i] - current) < Math.abs(visibleSize(best, half, full) - current) ? st : best), state);
    }
    setDrag(null);
    onStateChange(next);
  }

  function onPointerCancel() {
    start.current = null;
    moved.current = false;
    setDrag(null);
  }

  // 포인터를 손잡이 줄이 붙잡고 있어서 클릭은 줄 전체에서 받는다. 끌기 직후의 클릭은 무시한다
  function onGripClick() {
    if (suppressClick.current) return;
    onStateChange(state === 'half' ? 'closed' : 'half');
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const openKey = axis === 'y' ? 'ArrowUp' : 'ArrowLeft';
    const closeKey = axis === 'y' ? 'ArrowDown' : 'ArrowRight';
    if (event.key !== openKey && event.key !== closeKey) return;
    event.preventDefault();
    const index = ORDER.indexOf(state) + (event.key === openKey ? 1 : -1);
    onStateChange(ORDER[clamp(index, 0, ORDER.length - 1)]);
  }

  return (
    <section
      className="swipe-panel"
      data-panel={id}
      data-axis={axis}
      data-state={state}
      data-dragging={drag !== null}
      hidden={!active}
      aria-label={title}
      // 드러난 크기만큼만 차지해서, 내용이 실제 보이는 폭에 맞춰 배치되고 끝까지 스크롤된다
      style={axis === 'y' ? { height: visible } : { width: visible }}
    >
      <div
        className="swipe-panel__grip"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onGripClick}
      >
        <span className="swipe-panel__handle" aria-hidden="true" />
        <button
          type="button"
          className="swipe-panel__toggle"
          aria-expanded={state !== 'closed'}
          aria-controls={`swipe-panel-body-${id}`}
          aria-label={`${title} 탭 ${state === 'closed' ? '열기' : '접기'}`}
          onKeyDown={onKeyDown}
        />
      </div>
      <div id={`swipe-panel-body-${id}`} className="swipe-panel__body" aria-hidden={state === 'closed'}>
        {children}
      </div>
    </section>
  );
}
