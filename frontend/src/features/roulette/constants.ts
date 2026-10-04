/** 화면 전용 상수. 룰렛에 올리는 기본 메뉴와 빠른 구성은 앱이 정한 콘텐츠라 DB 가 아니라 여기 둔다 */
import type { MenuPreset, RouletteMenu } from './types';

/** 룰렛 구성을 한 번에 갈아끼우는 빠른 구성 */
export const MENU_PRESETS: MenuPreset[] = [
  { key: 'all', label: '전체 메뉴' },
  { key: 'meal', label: '든든한 식사' },
  { key: 'solo', label: '혼밥' },
  { key: 'snack', label: '가벼운 간식' },
];

export const MENUS: RouletteMenu[] = [
  {
    id: 'chicken',
    name: '치킨',
    emoji: '🍗',
    color: '#e9cf5e',
    headline: '바삭한 치킨 어때요?',
    groups: ['all', 'meal', 'snack'],
  },
  {
    id: 'rice-bowl',
    name: '덮밥',
    emoji: '🍚',
    color: '#f0a35e',
    headline: '든든한 덮밥 어때요?',
    groups: ['all', 'meal', 'solo'],
  },
  {
    id: 'pho',
    name: '쌀국수',
    emoji: '🍜',
    color: '#8fc9a0',
    headline: '따뜻한 쌀국수 어때요?',
    groups: ['all', 'meal', 'solo'],
  },
  {
    id: 'malatang',
    name: '마라탕',
    emoji: '🌶️',
    color: '#dd7f6b',
    headline: '얼큰한 마라탕 어때요?',
    groups: ['all', 'meal'],
  },
  {
    id: 'pasta',
    name: '파스타',
    emoji: '🍝',
    color: '#9dc0ea',
    headline: '부드러운 파스타 어때요?',
    groups: ['all', 'meal', 'solo'],
  },
  {
    id: 'gukbap',
    name: '국밥',
    emoji: '🍲',
    color: '#b3a4d4',
    headline: '뜨끈한 국밥 어때요?',
    groups: ['all', 'meal', 'solo'],
  },
  {
    id: 'salad',
    name: '샐러드',
    emoji: '🥗',
    color: '#c6dd8a',
    headline: '가볍게 샐러드 어때요?',
    groups: ['all', 'snack'],
  },
  {
    id: 'tteokbokki',
    name: '떡볶이',
    emoji: '🍢',
    color: '#ef9090',
    headline: '매콤한 떡볶이 어때요?',
    groups: ['all', 'snack'],
  },
];

export function menusForPreset(key: string): RouletteMenu[] {
  return MENUS.filter((menu) => menu.groups.includes(key));
}
