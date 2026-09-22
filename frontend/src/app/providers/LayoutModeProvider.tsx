import type { ReactNode } from 'react';
import { LayoutModeContext } from '../../core/device/LayoutModeContext';
import { useLayoutModeDetector } from '../../core/device/useLayoutModeDetector';

export default function LayoutModeProvider({ children }: { children: ReactNode }) {
  const mode = useLayoutModeDetector();
  return <LayoutModeContext.Provider value={mode}>{children}</LayoutModeContext.Provider>;
}