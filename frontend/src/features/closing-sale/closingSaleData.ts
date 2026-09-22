/** 마감세일 한 건. 손님 화면은 이 모양만 알면 되고, 나중에 사장님이 등록한 값이 그대로 들어온다. */
export interface ClosingSale {
  id: string;
  /** 가게 이름 */
  storeName: string;
  /** 업종 (베이커리 / 카페 / 반찬 …) */
  category: string;
  /** 어떤 상품을 얼마나 깎아 주는지 한 줄 설명 */
  desc: string;
  /** 할인율(%) */
  discount: number;
  /** 도보 몇 분 거리인지 */
  walkMinutes: number;
  /** 이 세일을 관심 등록한 사람 수 */
  likes: number;
  /** 세일이 끝나는 시각 (ISO 문자열). 백엔드가 주는 값도 같은 형식으로 맞춘다. */
  closeAt: string;
  /** 카드 상단 색 띠 */
  tone: SaleTone;
}

/** 카드 상단 그라데이션 색. 데이터에 색을 넣어 두면 화면 코드는 색을 몰라도 된다. */
export type SaleTone = 'orange' | 'blue' | 'purple' | 'green' | 'pink';

export interface SaleSort {
  key: SaleSortKey;
  label: string;
}

export type SaleSortKey = 'closing' | 'discount' | 'near';

/** 목록 정렬 방식 */
export const SALE_SORTS: SaleSort[] = [
  { key: 'closing', label: '마감 임박순' },
  { key: 'discount', label: '할인율순' },
  { key: 'near', label: '가까운순' },
];

/**
 * 예시 세일. 시연할 때 항상 "지금부터 N분 뒤 마감"으로 보이도록
 * 마감 시각은 고정값이 아니라 화면을 연 시각 기준 오프셋(분)으로 갖고 있는다.
 * 실제 데이터가 붙으면 saleSource.ts 에서 이 배열만 걷어내면 된다.
 */
export interface SaleSeed extends Omit<ClosingSale, 'closeAt'> {
  /** 지금부터 몇 분 뒤에 마감하는지 */
  closesInMinutes: number;
}

export const SALE_SEEDS: SaleSeed[] = [
  {
    id: 'sodam-bakery',
    storeName: '소담 베이커리',
    category: '베이커리',
    desc: '당일 생산 빵 전 품목 마감 할인',
    discount: 30,
    walkMinutes: 3,
    likes: 28,
    closesInMinutes: 42,
    tone: 'orange',
  },
  {
    id: 'afternoon-coffee',
    storeName: '오후의 커피',
    category: '카페',
    desc: '디저트 세트 및 베이커리 전 품목',
    discount: 20,
    walkMinutes: 6,
    likes: 16,
    closesInMinutes: 78,
    tone: 'blue',
  },
  {
    id: 'mom-banchan',
    storeName: '엄마 손맛 반찬',
    category: '반찬',
    desc: '오늘 만든 반찬 5종 이상 구매 시',
    discount: 40,
    walkMinutes: 8,
    likes: 42,
    closesInMinutes: 125,
    tone: 'purple',
  },
  {
    id: 'wolgye-fruit',
    storeName: '월계 과일가게',
    category: '청과',
    desc: '남은 제철 과일 한 상자 떨이',
    discount: 35,
    walkMinutes: 4,
    likes: 21,
    closesInMinutes: 96,
    tone: 'green',
  },
  {
    id: 'hansol-sushi',
    storeName: '한솥 초밥',
    category: '일식',
    desc: '모둠 초밥 · 회덮밥 포장 한정',
    discount: 25,
    walkMinutes: 11,
    likes: 34,
    closesInMinutes: 55,
    tone: 'pink',
  },
  {
    id: 'daily-salad',
    storeName: '데일리 샐러드',
    category: '샐러드',
    desc: '당일 제조 샐러드·랩 전 품목',
    discount: 50,
    walkMinutes: 7,
    likes: 19,
    closesInMinutes: 30,
    tone: 'orange',
  },
];
