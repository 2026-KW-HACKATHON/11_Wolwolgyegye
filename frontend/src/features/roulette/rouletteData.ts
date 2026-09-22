/** 룰렛 한 칸. 사용자가 직접 추가한 메뉴도 같은 모양을 쓴다. */
export interface WheelMenu {
  id: string;
  name: string;
  emoji: string;
  /** 룰렛 칸 색. 밝은 파스텔이라 글자는 항상 짙은 색으로 올린다. */
  color: string;
  headline?: string;
}

export interface RouletteMenu extends WheelMenu {
  groups: string[];
}

/** 직접 추가한 메뉴에 돌아가며 입히는 칸 색 */
export const WHEEL_COLORS = [
  '#e9cf5e',
  '#f0a35e',
  '#8fc9a0',
  '#dd7f6b',
  '#9dc0ea',
  '#b3a4d4',
  '#c6dd8a',
  '#ef9090',
];

export interface MenuPreset {
  key: string;
  label: string;
}

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

export interface MenuStore {
  id: string;
  /** 메뉴 이름으로 잇는다. 직접 입력한 메뉴도 이름만 같으면 가게가 붙는다. */
  menuName: string;
  name: string;
  desc: string;
  tagLabel: string;
  rating: number;
  reviews: number;
  emoji: string;
}

/**
 * 메뉴별 예시 가게.
 * 실제 가게 정보는 나중에 데이터베이스에서 받아올 예정이라,
 * 화면은 이 배열이 아니라 menuStoreSource 의 조회 함수만 바라본다.
 */
export const MENU_STORES: MenuStore[] = [
  {
    id: 'chicken-1',
    menuName: '치킨',
    name: '월계통닭',
    desc: '바삭하게 튀겨낸 옛날 통닭',
    tagLabel: '치킨',
    rating: 4.7,
    reviews: 286,
    emoji: '🍗',
  },
  {
    id: 'chicken-2',
    menuName: '치킨',
    name: '꼬꼬반반',
    desc: '반반 메뉴가 강한 동네 치킨집',
    tagLabel: '치킨',
    rating: 4.5,
    reviews: 154,
    emoji: '🍽️',
  },
  {
    id: 'chicken-3',
    menuName: '치킨',
    name: '치킨앤비어 광운대점',
    desc: '생맥주와 함께 즐기는 안주 치킨',
    tagLabel: '유사 메뉴',
    rating: 4.4,
    reviews: 402,
    emoji: '🍺',
  },
  {
    id: 'rice-bowl-1',
    menuName: '덮밥',
    name: '하루덮밥',
    desc: '매일 바뀌는 덮밥 한 그릇',
    tagLabel: '덮밥',
    rating: 4.6,
    reviews: 198,
    emoji: '🍚',
  },
  {
    id: 'rice-bowl-2',
    menuName: '덮밥',
    name: '연어랑',
    desc: '두툼한 연어가 올라간 사케동',
    tagLabel: '덮밥',
    rating: 4.8,
    reviews: 341,
    emoji: '🍣',
  },
  {
    id: 'rice-bowl-3',
    menuName: '덮밥',
    name: '분식마루',
    desc: '카레와 덮밥을 함께 파는 분식집',
    tagLabel: '유사 메뉴',
    rating: 4.3,
    reviews: 120,
    emoji: '🍛',
  },
  {
    id: 'pho-1',
    menuName: '쌀국수',
    name: '포메인 캠퍼스점',
    desc: '진한 육수와 푸짐한 고기 쌀국수',
    tagLabel: '쌀국수',
    rating: 4.8,
    reviews: 241,
    emoji: '🍜',
  },
  {
    id: 'pho-2',
    menuName: '쌀국수',
    name: '하노이 키친',
    desc: '혼밥하기 좋은 아늑한 로컬 맛집',
    tagLabel: '베트남 음식',
    rating: 4.6,
    reviews: 173,
    emoji: '🥢',
  },
  {
    id: 'pho-3',
    menuName: '쌀국수',
    name: '미분당',
    desc: '매콤하고 깊은 맛의 차돌 양지 쌀국수',
    tagLabel: '유사 메뉴',
    rating: 4.7,
    reviews: 318,
    emoji: '🍲',
  },
  {
    id: 'malatang-1',
    menuName: '마라탕',
    name: '라공방 마라탕',
    desc: '재료를 골라 담는 즉석 마라탕',
    tagLabel: '마라탕',
    rating: 4.5,
    reviews: 260,
    emoji: '🌶️',
  },
  {
    id: 'malatang-2',
    menuName: '마라탕',
    name: '천진 마라샹궈',
    desc: '불맛을 살린 마라샹궈 전문점',
    tagLabel: '중식',
    rating: 4.4,
    reviews: 131,
    emoji: '🥘',
  },
  {
    id: 'malatang-3',
    menuName: '마라탕',
    name: '훠궈하우스',
    desc: '1인 훠궈로 즐기는 얼큰한 국물',
    tagLabel: '유사 메뉴',
    rating: 4.6,
    reviews: 205,
    emoji: '🍲',
  },
  {
    id: 'pasta-1',
    menuName: '파스타',
    name: '파스타공방',
    desc: '직접 뽑은 생면으로 만드는 파스타',
    tagLabel: '파스타',
    rating: 4.7,
    reviews: 176,
    emoji: '🍝',
  },
  {
    id: 'pasta-2',
    menuName: '파스타',
    name: '비스트로 월계',
    desc: '와인과 함께 즐기는 저녁 양식',
    tagLabel: '양식',
    rating: 4.5,
    reviews: 143,
    emoji: '🥖',
  },
  {
    id: 'pasta-3',
    menuName: '파스타',
    name: '오븐앤누들',
    desc: '치즈 듬뿍 올린 오븐 파스타',
    tagLabel: '유사 메뉴',
    rating: 4.4,
    reviews: 228,
    emoji: '🧀',
  },
  {
    id: 'gukbap-1',
    menuName: '국밥',
    name: '월계순대국',
    desc: '푹 끓여낸 진한 국물의 순대국',
    tagLabel: '국밥',
    rating: 4.6,
    reviews: 389,
    emoji: '🍲',
  },
  {
    id: 'gukbap-2',
    menuName: '국밥',
    name: '소머리국밥집',
    desc: '맑은 국물이 시원한 소머리국밥',
    tagLabel: '국밥',
    rating: 4.7,
    reviews: 214,
    emoji: '🥣',
  },
  {
    id: 'gukbap-3',
    menuName: '국밥',
    name: '한솥설렁탕',
    desc: '밑반찬이 넉넉한 설렁탕집',
    tagLabel: '유사 메뉴',
    rating: 4.3,
    reviews: 167,
    emoji: '🍚',
  },
  {
    id: 'salad-1',
    menuName: '샐러드',
    name: '그린보울',
    desc: '매일 아침 손질하는 샐러드 보울',
    tagLabel: '샐러드',
    rating: 4.6,
    reviews: 152,
    emoji: '🥗',
  },
  {
    id: 'salad-2',
    menuName: '샐러드',
    name: '샐러디 광운대점',
    desc: '원하는 재료로 조합하는 샐러드',
    tagLabel: '샐러드',
    rating: 4.5,
    reviews: 301,
    emoji: '🥬',
  },
  {
    id: 'salad-3',
    menuName: '샐러드',
    name: '포케하우스',
    desc: '든든한 한 끼가 되는 포케 보울',
    tagLabel: '유사 메뉴',
    rating: 4.7,
    reviews: 189,
    emoji: '🍱',
  },
  {
    id: 'tteokbokki-1',
    menuName: '떡볶이',
    name: '월계분식',
    desc: '쌀떡으로 만든 국물 떡볶이',
    tagLabel: '떡볶이',
    rating: 4.5,
    reviews: 412,
    emoji: '🍢',
  },
  {
    id: 'tteokbokki-2',
    menuName: '떡볶이',
    name: '신전떡볶이 광운대점',
    desc: '매운맛 단계를 고를 수 있는 곳',
    tagLabel: '떡볶이',
    rating: 4.4,
    reviews: 265,
    emoji: '🌶️',
  },
  {
    id: 'tteokbokki-3',
    menuName: '떡볶이',
    name: '튀김만두',
    desc: '즉석에서 튀겨주는 모둠 튀김',
    tagLabel: '유사 메뉴',
    rating: 4.6,
    reviews: 148,
    emoji: '🥟',
  },
];
