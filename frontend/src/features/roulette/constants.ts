/**
 * 화면 전용 상수. 룰렛에 올리는 기본 메뉴와 빠른 구성은 앱이 정한 콘텐츠라 DB 가 아니라 여기 둔다.
 * 메뉴는 DB(store_menus·stores)에 실제로 파는 가게가 있는 것만 골랐다. 가게 찾는 기준(keywords 등)은 types.ts 의 MenuMatch 참고.
 * industries·looseIndustries 값은 stores.industry 원본 업종 그대로 적는다 (예: '빵/도넛').
 */
import type { Cuisine, MenuPreset, RouletteMenu } from './types';

/** 룰렛 구성을 한 번에 갈아끼우는 빠른 구성. 첫 번째가 처음 켰을 때의 구성 */
export const MENU_PRESETS: MenuPreset[] = [
  { key: 'popular', label: '인기 메뉴' },
  { key: 'meal', label: '든든한 식사' },
  { key: 'solo', label: '혼밥' },
  { key: 'soup', label: '국물 요리' },
  { key: 'night', label: '야식·술자리' },
  { key: 'snack', label: '가벼운 간식' },
];

export const DEFAULT_PRESET = MENU_PRESETS[0].key;

/** 메뉴 편집에서 "추천 메뉴 더하기" 목록을 나누는 탭 */
export const CUISINES: { key: Cuisine; label: string }[] = [
  { key: 'korean', label: '한식' },
  { key: 'japanese', label: '일식' },
  { key: 'chinese', label: '중식' },
  { key: 'etc', label: '기타' },
];

export const MENUS: RouletteMenu[] = [
  {
    id: 'chicken', name: '치킨', emoji: '🍗', cuisine: 'etc', headline: '바삭한 치킨 어때요?',
    keywords: ['치킨', '통닭', '닭강정'],
    exclude: ['까스', '마요', '버거', '샐러드', '도시락', '덮밥', '텐더', '너겟', '스테이크', '볶음밥', '카레', '부리또', '브리또', '랩', '피자'],
    industries: ['치킨'],
    groups: ['popular', 'night'],
  },
  {
    id: 'pizza', name: '피자', emoji: '🍕', cuisine: 'etc', headline: '치즈 듬뿍 피자 어때요?',
    keywords: ['피자'], industries: ['피자'],
    groups: ['popular', 'night'],
  },
  {
    id: 'burger', name: '버거', emoji: '🍔', cuisine: 'etc', headline: '한 손에 버거 어때요?',
    keywords: ['버거'], industries: ['버거'],
    groups: ['solo', 'snack'],
  },
  {
    id: 'jjajang', name: '짜장·짬뽕', emoji: '🥢', cuisine: 'chinese', headline: '짜장이냐 짬뽕이냐, 중식 어때요?',
    keywords: ['짜장', '짬뽕', '탕수육'], industries: ['중국집'],
    groups: ['popular', 'meal'],
  },
  {
    id: 'malatang', name: '마라탕', emoji: '🌶️', cuisine: 'chinese', headline: '얼얼한 마라탕 어때요?',
    // 마라탕집은 아직 메뉴판이 없어 가게 이름(○○마라탕)과 업종으로 찾는다. 메뉴판이 생기면 메뉴 이름으로도 잡힌다
    keywords: ['마라탕', '마라샹궈', '훠궈'], industries: ['마라탕/훠궈'],
    groups: ['popular', 'solo'],
  },
  {
    id: 'sushi', name: '초밥·회', emoji: '🍣', cuisine: 'japanese', headline: '신선한 초밥 어때요?',
    keywords: ['초밥', '스시', '사시미', '모둠회', '연어'], exclude: ['또띠아'], storeNames: ['참치'],
    // 상가정보의 '일식 회/초밥'은 카레·돈까스·이자카야 같은 일식집 전체에 붙어 있어 쓰지 않는다
    looseIndustries: ['횟집'],
    groups: ['popular', 'night'],
  },
  {
    id: 'donkatsu', name: '돈까스', emoji: '🍖', cuisine: 'japanese', headline: '겉바속촉 돈까스 어때요?',
    keywords: ['돈까스', '돈가스', '카츠'], looseIndustries: ['일식 카레/돈가스/덮밥'],
    groups: ['popular', 'meal', 'solo'],
  },
  {
    id: 'pasta', name: '파스타', emoji: '🍝', cuisine: 'etc', headline: '부드러운 파스타 어때요?',
    keywords: ['파스타', '스파게티', '까르보', '알리오', '봉골레', '리조또'], industries: ['파스타/스테이크'],
    groups: ['popular'],
  },
  {
    id: 'gukbap', name: '국밥', emoji: '🍲', cuisine: 'korean', headline: '뜨끈한 국밥 어때요?',
    keywords: ['국밥', '순대국', '해장국', '설렁탕', '곰탕'], looseIndustries: ['국/탕/찌개류'],
    groups: ['popular', 'meal', 'solo', 'soup'],
  },
  {
    id: 'gamjatang', name: '감자탕', emoji: '🦴', cuisine: 'korean', headline: '푸짐한 감자탕 어때요?',
    keywords: ['감자탕', '뼈해장', '뼈다귀'],
    groups: ['soup', 'night'],
  },
  {
    id: 'kimchi-stew', name: '김치찌개', emoji: '🥘', cuisine: 'korean', headline: '얼큰한 김치찌개 어때요?',
    keywords: ['김치찌개'],
    groups: ['popular', 'meal', 'soup'],
  },
  {
    id: 'doenjang-stew', name: '된장찌개', emoji: '🫕', cuisine: 'korean', headline: '구수한 된장찌개 어때요?',
    keywords: ['된장찌개'],
    groups: ['meal', 'soup'],
  },
  {
    id: 'budae-stew', name: '부대찌개', emoji: '🌭', cuisine: 'korean', headline: '라면사리 넣은 부대찌개 어때요?',
    keywords: ['부대찌개'],
    groups: ['soup', 'night'],
  },
  {
    id: 'sundubu', name: '순두부', emoji: '🥚', cuisine: 'korean', headline: '보들보들 순두부찌개 어때요?',
    keywords: ['순두부'],
    groups: ['soup'],
  },
  {
    id: 'kalguksu', name: '칼국수', emoji: '🍜', cuisine: 'korean', headline: '쫄깃한 칼국수 어때요?',
    keywords: ['칼국수', '수제비'], looseIndustries: ['국수/칼국수'],
    groups: ['meal', 'soup'],
  },
  {
    id: 'udon', name: '우동', emoji: '🍥', cuisine: 'japanese', headline: '따끈한 우동 어때요?',
    keywords: ['우동'], looseIndustries: ['일식 면 요리'],
    groups: ['solo', 'soup'],
  },
  {
    id: 'ramyeon', name: '라면', emoji: '🍜', cuisine: 'korean', headline: '분식집 라면 어때요?',
    keywords: ['라면'], exclude: ['사리'],
    groups: ['solo', 'soup'],
  },
  {
    id: 'naengmyeon', name: '냉면', emoji: '🧊', cuisine: 'korean', headline: '시원한 냉면 어때요?',
    keywords: ['냉면', '막국수'],
    groups: ['popular', 'meal'],
  },
  {
    id: 'jeyuk', name: '제육볶음', emoji: '🐷', cuisine: 'korean', headline: '밥도둑 제육볶음 어때요?',
    keywords: ['제육'],
    groups: ['popular', 'meal', 'solo'],
  },
  {
    id: 'bulgogi', name: '불고기', emoji: '🥩', cuisine: 'korean', headline: '달달한 불고기 어때요?',
    keywords: ['불고기'],
    groups: ['meal'],
  },
  {
    id: 'bibimbap', name: '비빔밥', emoji: '🥗', cuisine: 'korean', headline: '골고루 비빔밥 어때요?',
    keywords: ['비빔밥'],
    groups: ['meal', 'solo'],
  },
  {
    id: 'rice-bowl', name: '덮밥', emoji: '🍚', cuisine: 'japanese', headline: '든든한 덮밥 어때요?',
    keywords: ['덮밥', '규동', '텐동', '부타동'],
    groups: ['meal', 'solo'],
  },
  {
    id: 'fried-rice', name: '볶음밥', emoji: '🍳', cuisine: 'chinese', headline: '고슬고슬 볶음밥 어때요?',
    keywords: ['볶음밥'],
    groups: ['solo'],
  },
  {
    id: 'omurice', name: '오므라이스', emoji: '🍛', cuisine: 'japanese', headline: '폭신한 오므라이스 어때요?',
    keywords: ['오므라이스'],
    groups: ['solo'],
  },
  {
    id: 'curry', name: '카레', emoji: '🍛', cuisine: 'japanese', headline: '향긋한 카레 어때요?',
    keywords: ['카레'],
    groups: ['meal', 'solo'],
  },
  {
    id: 'lunchbox', name: '도시락·컵밥', emoji: '🍱', cuisine: 'korean', headline: '간편하게 도시락 어때요?',
    keywords: ['도시락', '컵밥'],
    groups: ['solo'],
  },
  {
    id: 'kimbap', name: '김밥', emoji: '🍙', cuisine: 'korean', headline: '간단하게 김밥 어때요?',
    keywords: ['김밥'],
    groups: ['solo', 'snack'],
  },
  {
    id: 'tteokbokki', name: '떡볶이', emoji: '🍢', cuisine: 'korean', headline: '매콤한 떡볶이 어때요?',
    keywords: ['떡볶이'],
    groups: ['popular', 'snack', 'night'],
  },
  {
    id: 'dumpling', name: '만두', emoji: '🥟', cuisine: 'chinese', headline: '육즙 가득 만두 어때요?',
    keywords: ['만두'],
    groups: ['snack'],
  },
  {
    id: 'toast', name: '토스트', emoji: '🥪', cuisine: 'etc', headline: '바삭한 토스트 어때요?',
    keywords: ['토스트', '샌드위치'], looseIndustries: ['토스트/샌드위치/샐러드'],
    groups: ['solo', 'snack'],
  },
  {
    id: 'salad', name: '샐러드', emoji: '🥬', cuisine: 'etc', headline: '가볍게 샐러드 어때요?',
    keywords: ['샐러드', '포케'], exclude: ['콘샐러드', '양배추'],
    groups: ['snack'],
  },
  {
    id: 'bread', name: '빵', emoji: '🥐', cuisine: 'etc', headline: '갓 구운 빵 어때요?',
    keywords: ['베이글', '케이크', '크루아상', '식빵', '소금빵'], industries: ['빵/도넛'],
    groups: ['snack'],
  },
  {
    id: 'waffle', name: '와플·츄러스', emoji: '🧇', cuisine: 'etc', headline: '달콤한 와플 어때요?',
    keywords: ['와플', '크로플', '츄러스', '도넛', '핫도그'],
    groups: ['snack'],
  },
  {
    id: 'bingsu', name: '빙수', emoji: '🍧', cuisine: 'etc', headline: '시원한 빙수 어때요?',
    keywords: ['빙수', '아이스크림'],
    groups: ['snack'],
  },
  {
    id: 'samgyeopsal', name: '삼겹살', emoji: '🥓', cuisine: 'korean', headline: '지글지글 삼겹살 어때요?',
    keywords: ['삼겹', '오겹', '목살'], looseIndustries: ['돼지고기 구이/찜'],
    groups: ['popular', 'night'],
  },
  {
    id: 'jokbal', name: '족발·보쌈', emoji: '🍖', cuisine: 'korean', headline: '쫀득한 족발 어때요?',
    keywords: ['족발', '보쌈'], industries: ['족발/보쌈'],
    groups: ['night'],
  },
  {
    id: 'gopchang', name: '곱창', emoji: '🔥', cuisine: 'korean', headline: '고소한 곱창 어때요?',
    keywords: ['곱창', '대창', '막창'], industries: ['곱창 전골/구이'],
    groups: ['night'],
  },
  {
    id: 'dakgalbi', name: '닭갈비', emoji: '🐔', cuisine: 'korean', headline: '철판 닭갈비 어때요?',
    keywords: ['닭갈비'], looseIndustries: ['닭/오리고기 구이/찜'],
    groups: ['night'],
  },
  {
    id: 'jjimdak', name: '찜닭', emoji: '🍗', cuisine: 'korean', headline: '달짝지근한 찜닭 어때요?',
    keywords: ['찜닭', '닭도리탕', '닭볶음탕'],
    groups: ['meal', 'night'],
  },
  {
    id: 'jeon', name: '전', emoji: '🥞', cuisine: 'korean', headline: '비 오는 날엔 전 어때요?',
    keywords: ['파전', '부침개', '모둠전', '김치전', '빈대떡', '굴전', '부추전'], industries: ['전/부침개'],
    groups: ['night'],
  },
  {
    id: 'yukhoe', name: '육회', emoji: '🥩', cuisine: 'korean', headline: '고소한 육회 어때요?',
    keywords: ['육회'],
    groups: ['night'],
  },
];

export function menusForPreset(key: string): RouletteMenu[] {
  return MENUS.filter((menu) => menu.groups.includes(key));
}
