/**
 * 사용자가 켜 둔 "선택형" 카테고리 id 목록.
 * 지금은 하드코딩. 설정 화면 토글이 붙으면 이 값을 로컬 저장(비로그인) / DB(로그인)에서 읽도록 바꾼다.
 * 고정 카테고리(isFixed)는 여기에 넣지 않아도 항상 노출된다.
 */
export const DEFAULT_ENABLED_IDS: string[] = [
  'space-rental',
  'oneday-class',
  'roulette',
  'closing-sale',
  'coupon',
  'partner-stores',
];