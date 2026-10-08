import { useSyncExternalStore } from 'react';

export type MarkerStyleId = 'signboard' | 'classic' | 'diamond';

export interface MarkerStyleOption {
  id: MarkerStyleId;
  name: string;
  desc: string;
}

export const MARKER_STYLES: MarkerStyleOption[] = [
  { id: 'signboard', name: '동네 간판', desc: '아이보리와 자주색의 작은 가게 간판' },
  { id: 'classic', name: '클래식 핀', desc: '눈에 잘 띄는 주황색 위치 핀' },
  { id: 'diamond', name: '다이아 핀', desc: '청록색과 금색의 또렷한 마름모' },
];

const STORAGE_KEY = 'wol-map-marker-style-v1';
const EVENT = 'wol-map-marker-style-changed';
const DEFAULT: MarkerStyleId = 'signboard';
const isMarkerStyle = (value: unknown): value is MarkerStyleId => MARKER_STYLES.some(({ id }) => id === value);

export function readMarkerStyle(): MarkerStyleId {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isMarkerStyle(saved) ? saved : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let currentStyle = typeof window === 'undefined' ? DEFAULT : readMarkerStyle();

export function setMarkerStyle(style: MarkerStyleId): void {
  currentStyle = style;
  try { window.localStorage.setItem(STORAGE_KEY, style); } catch { /* 이번 실행에서만 유지 */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useMarkerStyle(): MarkerStyleId {
  return useSyncExternalStore(subscribe, () => currentStyle, () => DEFAULT);
}
