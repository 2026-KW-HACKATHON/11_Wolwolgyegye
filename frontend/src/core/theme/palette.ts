import { useSyncExternalStore } from 'react';

/**
 * 색상 팔레트 고르기. 고른 팔레트는 <html data-palette="…"> 로 달고 이 기기에 저장한다.
 * 색 값은 shared/theme.css 의 [data-palette='N'] 블록에 있다 (여기는 id 와 이름만).
 */
export type PaletteId = '1' | '2' | '3' | '4' | '5';

export interface PaletteOption {
  id: PaletteId;
  name: string;
  desc: string;
}

export const PALETTES: PaletteOption[] = [
  { id: '1', name: '네이비 오렌지', desc: '프러시안 블루 · 오렌지 · 그레이' },
  { id: '2', name: '테라코타 틸', desc: '인디고 · 피치 · 틸 · 에그셸' },
  { id: '3', name: '레드 블루', desc: '딥 블루 · 브릭 레드 · 스틸 블루 · 파파야' },
  { id: '4', name: '코랄 틸', desc: '틸 · 코랄 · 허니 · 로즈 · 리넨' },
  { id: '5', name: '인디고 팝', desc: '인디고 · 워터멜론 · 골드 · 그린 · 터콰이즈' },
];

/** 팔레트 번호가 바뀌어(2026-10) 이전 저장값과 섞이지 않게 v2 */
const STORAGE_KEY = 'wol-palette-v2';
const EVENT = 'wol-palette-changed';
const DEFAULT: PaletteId = '1';

const isPalette = (v: unknown): v is PaletteId => PALETTES.some((p) => p.id === v);

export function readPalette(): PaletteId {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isPalette(saved) ? saved : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/** <html> 에 팔레트를 단다. 앱을 그리기 전에 한 번(main.tsx), 바꿀 때마다 부른다 */
export function applyPalette(id: PaletteId): void {
  document.documentElement.dataset.palette = id;
}

export function setPalette(id: PaletteId): void {
  applyPalette(id);
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* 이번 실행에서만 유지 */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
const current = (): PaletteId => (isPalette(document.documentElement.dataset.palette) ? document.documentElement.dataset.palette as PaletteId : DEFAULT);

/** 지금 팔레트. 바뀌면 다시 그린다 (지도처럼 색을 한 번 읽어 두는 곳이 다시 읽게 할 때 쓴다) */
export function usePalette(): PaletteId {
  return useSyncExternalStore(subscribe, current);
}
