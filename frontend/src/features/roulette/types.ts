import type { Store } from '../../core/types/place';

/**
 * '룰렛' 카테고리 전용 데이터.
 * 여기 있는 타입은 이 카테고리에서만 쓰며, 다른 팀원과 조율 없이 자유롭게 고치고 늘려도 된다.
 * 가게 이름·위치는 여기 두지 않고 storeId 로 core 의 Store 를 참조한다.
 */

/** 룰렛 한 칸. 사용자가 직접 추가한 메뉴도 같은 모양을 쓴다. */
export interface WheelMenu {
  id: string;
  name: string;
  emoji: string;
  /** 룰렛 칸 색 (theme.css 의 --wheel-N). 밝은 색이라 글자는 항상 짙은 색으로 올린다. */
  color: string;
  headline?: string;
}

export interface RouletteMenu extends WheelMenu {
  groups: string[];
}

export interface MenuPreset {
  key: string;
  label: string;
}

/** 메뉴 -> 가게 연결 한 건 (DB store_menus 에서 메뉴 이름으로 찾은 한 행) */
export interface RouletteStoreLink {
  id: string;
  /** 메뉴 이름으로 잇는다. 직접 입력한 메뉴도 이름만 같으면 가게가 붙는다. */
  menuName: string;
  storeId: string;
  /** 이 메뉴 기준으로 가게를 소개하는 한 줄 */
  desc: string;
  /** 카드 위 작은 표시 (예: "치킨", "유사 메뉴") */
  tagLabel: string;
}

/** 화면이 받는 모양: 연결 정보 + 가게 공통 정보 + 도보 시간 (source.ts 가 조합) */
export interface RouletteStoreView extends RouletteStoreLink {
  store: Store;
  walkMinutes: number;
}
