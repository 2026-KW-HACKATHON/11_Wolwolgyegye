import { useEffect, useState } from 'react';
import { detectLayoutMode, TOUCH_PRIMARY_QUERY, type LayoutMode } from './layoutMode';

/**
 * 현재 기기 모드를 계산하고, 창 크기/방향/입력 장치가 바뀔 때 다시 계산한다.
 * (브라우저 이벤트만 쓰므로 네트워크 통신 없이 즉시 반응)
 */
export function useLayoutModeDetector(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() => detectLayoutMode());

  useEffect(() => {
    const update = () => setMode(detectLayoutMode());

    const touchQuery = window.matchMedia(TOUCH_PRIMARY_QUERY);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.screen.orientation?.addEventListener('change', update);
    touchQuery.addEventListener('change', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.screen.orientation?.removeEventListener('change', update);
      touchQuery.removeEventListener('change', update);
    };
  }, []);

  return mode;
}