/**
 * "그 외 카테고리": 메인 카테고리 외의 업종 구분 = DB 의 대표 유형(store_types).
 * 고르면 지도에 그 업종 가게만 표시한다. 아이콘이 정해지기 전까지는 번호 + 글자로 표시한다.
 * 음식점·카페·편의점에 들지 않는 가게는 모두 "그 외" 묶음으로 모은다.
 *
 * - 이 목록이 기준이다. scripts/import-stores.js 가 이 목록을 store_types 표에 그대로 넣고,
 *   상가정보 업종(대·중·소분류)을 match 로 나눠 각 가게의 stores.type_id 를 정한다.
 * - 앱은 가게의 type_id 만 보고 항목을 찾는다 (subCategoryById).
 * 분류 값은 월계1동 상가정보(기준월 202606)에 실제로 있는 값을 기준으로 했다.
 */
export interface SubCategory {
  id: string;
  label: string;
  /** 묶음: restaurant(음식점) · cafe(카페) · convenience(편의점) · etc(그 외). 가게 점 색과 한 줄 목록의 구분선에 쓴다 */
  group: 'restaurant' | 'cafe' | 'convenience' | 'etc';
  /** 상가정보 업종이 이 항목에 드는지 (가게를 DB 에 넣을 때만 쓴다) */
  match: (industry: SbizIndustry) => boolean;
}

/** 상가정보 업종 대·중·소분류 (예: 음식 / 한식 / 백반/한정식) */
export interface SbizIndustry {
  large: string;
  middle: string;
  small: string;
}

const BAKERY_SMALLS = ['빵/도넛', '떡/한과', '아이스크림/빙수'];
const FAST_FOOD_SMALLS = ['버거', '피자', '토스트/샌드위치/샐러드'];
const isCafe = (s: SbizIndustry) => s.large === '음식' && s.middle === '비알코올';
const isBakery = (s: SbizIndustry) => s.large === '음식' && BAKERY_SMALLS.includes(s.small);
const isConvenience = (s: SbizIndustry) => s.small === '편의점';
const isRestaurant = (s: SbizIndustry) => s.large === '음식' && !isCafe(s) && !isBakery(s);
const SPECIFIC_FOOD = (s: SbizIndustry) =>
  ['한식', '중식', '일식', '서양식', '주점'].includes(s.middle) || s.small === '김밥/만두/분식' || s.small === '치킨' || FAST_FOOD_SMALLS.includes(s.small);
/** 그 외 묶음에 따로 항목을 두는 대분류 */
const ETC_LARGES = ['소매', '수리·개인', '예술·스포츠', '과학·기술', '교육', '보건의료', '부동산', '시설관리·임대', '숙박'];
const isEtc = (s: SbizIndustry) => !isRestaurant(s) && !isCafe(s) && !isBakery(s) && !isConvenience(s);

/** 표시 순서 = 번호 순서. 한 가게는 하나의 항목에만 든다 (각 match 가 겹치지 않게 짰다) */
export const SUB_CATEGORIES: SubCategory[] = [
  { id: 'korean', label: '한식', group: 'restaurant', match: (s) => isRestaurant(s) && s.middle === '한식' },
  { id: 'chinese', label: '중식', group: 'restaurant', match: (s) => isRestaurant(s) && s.middle === '중식' },
  { id: 'japanese', label: '일식', group: 'restaurant', match: (s) => isRestaurant(s) && s.middle === '일식' },
  { id: 'western', label: '양식', group: 'restaurant', match: (s) => isRestaurant(s) && s.middle === '서양식' },
  { id: 'snack', label: '분식', group: 'restaurant', match: (s) => isRestaurant(s) && s.small === '김밥/만두/분식' },
  { id: 'chicken', label: '치킨', group: 'restaurant', match: (s) => isRestaurant(s) && s.small === '치킨' },
  { id: 'fast-food', label: '버거·피자', group: 'restaurant', match: (s) => isRestaurant(s) && FAST_FOOD_SMALLS.includes(s.small) },
  { id: 'pub', label: '주점', group: 'restaurant', match: (s) => isRestaurant(s) && s.middle === '주점' },
  { id: 'food-etc', label: '기타 음식점', group: 'restaurant', match: (s) => isRestaurant(s) && !SPECIFIC_FOOD(s) },
  { id: 'cafe', label: '카페', group: 'cafe', match: isCafe },
  { id: 'bakery', label: '빵·디저트', group: 'cafe', match: isBakery },
  { id: 'convenience', label: '편의점', group: 'convenience', match: isConvenience },
  ...ETC_LARGES.map((large) => ({
    id: `etc-${large}`,
    label: large,
    group: 'etc' as const,
    match: (s: SbizIndustry) => isEtc(s) && s.large === large,
  })),
  { id: 'etc-other', label: '기타', group: 'etc', match: (s) => isEtc(s) && !ETC_LARGES.includes(s.large) },
];

/** 상가정보 업종 → 그 외 카테고리 항목 (가게를 DB 에 넣을 때) */
export function subCategoryOfIndustry(industry: SbizIndustry): SubCategory | undefined {
  return SUB_CATEGORIES.find((c) => c.match(industry));
}

/** 가게의 type_id → 그 외 카테고리 항목 */
export function subCategoryById(typeId: string | null): SubCategory | undefined {
  return typeId ? SUB_CATEGORIES.find((c) => c.id === typeId) : undefined;
}
