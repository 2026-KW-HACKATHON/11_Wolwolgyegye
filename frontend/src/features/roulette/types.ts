import type { Store } from '../../core/types/place';

/**
 * '룰렛' 카테고리 전용 데이터.
 * 여기 있는 타입은 이 카테고리에서만 쓰며, 다른 팀원과 조율 없이 자유롭게 고치고 늘려도 된다.
 * 가게 이름·위치는 여기 두지 않고 storeId 로 core 의 Store 를 참조한다.
 */

/** 룰렛 한 칸. 칸 색은 원판 위 자리로 정한다 (RoulettePage 의 wheelColor) */
export interface WheelMenu {
  id: string;
  name: string;
  emoji: string;
  headline?: string;
}

/**
 * 뽑힌 메뉴로 DB 에서 가게를 찾는 기준.
 * - keywords: store_menus.name 에 들어 있으면 그 메뉴를 파는 가게 (예: "돈까스", "돈가스", "카츠")
 * - exclude: keywords 에 걸렸어도 이 글자가 들면 뺀다 (예: 치킨 → "치킨까스", "치킨마요")
 * - industries: stores.industry (상가정보 원본 업종) 가 이 중 하나면 전문점
 * 가게 이름에 keywords 가 들어 있어도 전문점으로 본다 (예: "봉구스밥버거", "매튜스도넛")
 */
export interface MenuMatch {
  keywords: string[];
  exclude?: string[];
  industries?: string[];
}

/** 메뉴 편집에서 메뉴를 나눠 보여주는 분류 */
export type Cuisine = 'korean' | 'japanese' | 'chinese' | 'etc';

export interface RouletteMenu extends WheelMenu, MenuMatch {
  cuisine: Cuisine;
  groups: string[];
}

export interface MenuPreset {
  key: string;
  label: string;
}

/** 메뉴 -> 가게 연결 한 건 */
export interface RouletteStoreLink {
  id: string;
  menuName: string;
  storeId: string;
  /** 이 메뉴 기준으로 가게를 소개하는 한 줄 (예: "양념치킨 20,000원") */
  desc: string;
  /** 업종·가게 이름으로 찾은 전문점이면 true. 메뉴판에만 있는 가게보다 앞에 보여준다 */
  specialty: boolean;
}

/** 화면이 받는 모양: 연결 정보 + 가게 공통 정보 + 도보 시간 (source.ts 가 조합) */
export interface RouletteStoreView extends RouletteStoreLink {
  store: Store;
  walkMinutes: number;
  /** 카드 위 작은 표시 (예: "전문점", "한식") */
  tagLabel: string;
}
