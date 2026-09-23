import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastContextValue {
  message: string | null;
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  message: null,
  showToast: () => {},
});

const VISIBLE_MS = 1600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((next: string) => {
    setMessage(next);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  return <ToastContext.Provider value={{ message, showToast }}>{children}</ToastContext.Provider>;
}

/** 화면 어디서든 짧은 안내 토스트를 띄울 때 쓰는 훅 */
export function useToast(): (message: string) => void {
  return useContext(ToastContext).showToast;
}

export function useToastMessage(): string | null {
  return useContext(ToastContext).message;
}