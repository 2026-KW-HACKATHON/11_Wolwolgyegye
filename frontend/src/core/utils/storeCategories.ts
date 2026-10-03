/** 공공데이터의 세부 업종명을 주민이 찾기 쉬운 지도 분류로 묶는다. */
export const STORE_CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'food', label: '음식점' },
  { key: 'cafe', label: '카페·빵집' },
  { key: 'shopping', label: '마트·쇼핑' },
  { key: 'health', label: '건강·미용' },
  { key: 'learning', label: '배움·여가' },
  { key: 'services', label: '생활서비스' },
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number]['key'];

export function storeCategory(cuisineType?: string): Exclude<StoreCategory, 'all'> {
  const type = cuisineType?.trim() ?? '';
  // 스터디 카페는 음료 카페가 아니므로 학습을 먼저 검사한다.
  if (/학원|교육|훈련|독서실|스터디|헬스장|노래방|PC방|당구장|볼링장|탁구장|태권도|무술|게임장|오락|스포츠|레크리에이션/.test(type)) return 'learning';
  if (/의원|병원|약국|의료기기|안경|미용|네일|피부|마사지|안마|체형|비만|요가|필라테스|화장품/.test(type)) return 'health';
  if (/카페|커피|베이커리|빵|도넛|떡|한과|아이스크림|빙수/.test(type)) return 'cafe';
  if (/식당|음식점|백반|한정식|분식|치킨|고기|구이|찜|국\/|탕|찌개|국수|칼국수|냉면|밀면|버거|피자|파스타|스테이크|일식|중국집|마라|훠궈|족발|보쌈|곱창|주점|횟집|해산물|전\/부침개|샌드위치|샐러드|경양식/.test(type)) return 'food';
  if (/소매업|편의점|슈퍼마켓|할인점|정육점|꽃집|서점|복권/.test(type)) return 'shopping';
  return 'services';
}
