/**
 * 카카오맵 장소 정보 (사장님이 아직 정보를 등록하지 않은 가게의 홈 탭에서 보충용).
 *
 * 카카오맵 JavaScript SDK 의 장소 검색(services.Places.keywordSearch)으로, 가게 이름을 가게 좌표 근처에서 찾아
 * 같은 가게로 보이는 한 곳의 전화·업종·주소·카카오맵 링크를 돌려준다.
 * - 키: VITE_KAKAO_MAP_KEY (JavaScript 키). 카카오 개발자 콘솔 > 플랫폼 > Web 에 사이트 도메인을 등록해야 동작한다.
 *   키가 없거나 SDK 를 못 불러오면 null 을 돌려주고, 화면은 카카오 정보 없이 그린다.
 * - 이 API 는 영업시간·사진·후기를 주지 않는다. 그런 정보는 place_url(카카오맵 장소 페이지) 링크로 보낸다.
 */

export interface KakaoPlace {
  id: string;
  name: string;
  /** 예: 음식점 > 중식 > 중국요리 */
  category: string;
  phone: string;
  roadAddress: string;
  address: string;
  /** 카카오맵 장소 페이지 */
  url: string;
}

interface KakaoPlaceResult {
  id: string; place_name: string; category_name: string; phone: string;
  road_address_name: string; address_name: string; place_url: string; distance: string;
}

interface KakaoSdk {
  maps: {
    load: (callback: () => void) => void;
    services: {
      Places: new () => {
        keywordSearch: (query: string, callback: (data: KakaoPlaceResult[], status: string) => void, options?: Record<string, unknown>) => void;
      };
      Status: { OK: string; ZERO_RESULT: string; ERROR: string };
      SortBy: { DISTANCE: string };
    };
  };
}

declare global {
  interface Window { kakao?: KakaoSdk }
}

const KEY = import.meta.env.VITE_KAKAO_MAP_KEY?.trim();
/** 가게 좌표에서 이 거리(m) 안만 찾는다 */
const SEARCH_RADIUS_M = 300;
/** SDK 불러오기·검색이 이 시간 안에 끝나지 않으면 포기한다 ("찾는 중"에 멈춰 있지 않게) */
const TIMEOUT_MS = 8000;

const withTimeout = <T,>(job: Promise<T>, fallback: T) =>
  Promise.race([job, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), TIMEOUT_MS))]);

let sdkLoad: Promise<KakaoSdk | null> | null = null;

/** SDK 를 한 번만 불러온다. 실패하면 null (다음 호출 때 다시 시도) */
function loadSdk(): Promise<KakaoSdk | null> {
  if (!KEY) return Promise.resolve(null);
  if (sdkLoad) return sdkLoad;
  sdkLoad = new Promise<KakaoSdk | null>((resolve) => {
    const ready = () => window.kakao!.maps.load(() => resolve(window.kakao!));
    if (window.kakao?.maps) { ready(); return; }
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KEY)}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => (window.kakao?.maps ? ready() : resolve(null));
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  }).then((sdk) => { if (!sdk) sdkLoad = null; return sdk; });
  return sdkLoad;
}

/** 비교용 이름: 공백·괄호·특수문자를 빼고 소문자로 */
const normalize = (name: string) => name.replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^0-9a-zA-Z가-힣]/g, '').toLowerCase();

/** 검색 결과 중 같은 가게: 이름이 같거나(한쪽이 다른 쪽을 포함) 가장 가까운 곳. 이름이 전혀 안 맞으면 버린다 */
function pickSame(name: string, results: KakaoPlaceResult[]): KakaoPlaceResult | null {
  const target = normalize(name);
  if (!target) return null;
  const matches = results.filter((r) => {
    const candidate = normalize(r.place_name);
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
  matches.sort((a, b) => Number(a.distance || Infinity) - Number(b.distance || Infinity));
  return matches[0] ?? null;
}

const cache = new Map<string, Promise<KakaoPlace | null>>();

/** 가게 id 마다 한 번만 찾는다. 키가 없거나, 못 찾거나, 오류면 null */
export function findKakaoPlace(store: { id: string; name: string; lat: number | null; lng: number | null }): Promise<KakaoPlace | null> {
  const cached = cache.get(store.id);
  if (cached) return cached;
  const job = (async () => {
    if (!store.name.trim() || store.lat === null || store.lng === null) return null;
    const sdk = await withTimeout(loadSdk(), null);
    if (!sdk?.maps.services) return null; // 다른 곳에서 services 없이 SDK 를 먼저 불렀으면 장소 검색을 쓸 수 없다
    const results = await withTimeout(new Promise<KakaoPlaceResult[]>((resolve) => {
      new sdk.maps.services.Places().keywordSearch(store.name, (data, status) => {
        resolve(status === sdk.maps.services.Status.OK ? data : []);
      }, { x: store.lng, y: store.lat, radius: SEARCH_RADIUS_M, sort: sdk.maps.services.SortBy.DISTANCE });
    }), []);
    const hit = pickSame(store.name, results);
    return hit ? {
      id: hit.id, name: hit.place_name, category: hit.category_name, phone: hit.phone,
      roadAddress: hit.road_address_name, address: hit.address_name, url: hit.place_url,
    } : null;
  })().catch(() => null);
  cache.set(store.id, job);
  // 오류·키 없음으로 null 이 나온 경우도 이 화면에서는 다시 찾지 않는다 (새로고침하면 다시)
  return job;
}

export const KAKAO_ENABLED = !!KEY;
