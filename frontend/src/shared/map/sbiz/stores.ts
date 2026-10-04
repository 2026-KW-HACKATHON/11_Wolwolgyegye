// ---------------------------------------------------------------------
// 소상공인 상가(상권)정보 가게 — scripts/fetch-sbiz.js 가 저장한 public/data/sbiz/stores.geojson 만 읽는다.
// 원본 속성 이름(bizesNm, indsLclsNm 등)은 아래 normalizeSbizStore 에서만 사용한다.
// ---------------------------------------------------------------------
import type { Feature, FeatureCollection, Point } from 'geojson';

const STORES_URL = '/data/sbiz/stores.geojson';

/** 지도·목록에 쓰는 가게 한 곳 (월계1동 안의 가게만 들어 있다) */
export interface SbizStore {
  id: string;
  /** 상호 (지점명이 있으면 붙인다) */
  name: string;
  /** 업종 대분류 / 중분류 / 소분류 (예: 음식 / 한식 / 백반/한정식) */
  large: string;
  middle: string;
  small: string;
  /** 도로명주소, 없으면 지번주소 */
  address: string;
  /** "1층", "지하 1층" 같은 표시용 층. 없으면 '' */
  floor: string;
  /** 층 정렬용 숫자 (지하는 음수, 모르면 null) */
  floorNumber: number | null;
  /** 건물관리번호 (같은 건물 가게 묶기에 쓴다). 없으면 '' */
  buildingId: string;
  /** 건물명. 없으면 '' */
  buildingName: string;
  lat: number;
  lng: number;
}

export interface SbizData {
  stores: SbizStore[];
  /** 데이터 기준월 (예: 202606) */
  stdrYm: string;
}

const clean = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/** 층 번호 → 정렬용 숫자. "B1"·"-1" 은 지하(음수)로 본다. 모르면 null */
function floorNumberOf(raw: string): number | null {
  if (!raw) return null;
  const basement = /^(B|b|-)/.test(raw);
  const n = Number.parseInt(raw.replace(/^(B|b|-)/, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return basement ? -n : n;
}

const floorLabel = (n: number | null): string => (n === null ? '' : n < 0 ? `지하 ${-n}층` : `${n}층`);

/** 가게 feature → SbizStore. 좌표가 없으면 null */
function normalizeSbizStore(feature: Feature): SbizStore | null {
  const p = (feature.properties ?? {}) as Record<string, unknown>;
  if (feature.geometry?.type !== 'Point') return null;
  const [lng, lat] = (feature.geometry as Point).coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = clean(p.bizesNm);
  const branch = clean(p.brchNm);
  return {
    id: clean(feature.id) || clean(p.bizesId),
    name: branch ? `${name} ${branch}` : name || '이름 없는 가게',
    large: clean(p.indsLclsNm),
    middle: clean(p.indsMclsNm),
    small: clean(p.indsSclsNm),
    address: clean(p.rdnmAdr) || clean(p.lnoAdr),
    floor: floorLabel(floorNumberOf(clean(p.flrNo))),
    floorNumber: floorNumberOf(clean(p.flrNo)),
    buildingId: clean(p.bldMngNo),
    buildingName: clean(p.bldNm),
    lat,
    lng,
  };
}

/** 가게 데이터를 읽는다. 파일이 없으면 null (지도는 가게 없이 그대로 보인다) */
export async function loadSbizStores(): Promise<SbizData | null> {
  try {
    const res = await fetch(STORES_URL, { cache: 'no-cache' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').match(/json|geo/)) return null;
    const fc = (await res.json()) as FeatureCollection & { stdrYm?: string };
    const stores = (fc.features ?? []).map(normalizeSbizStore).filter((s): s is SbizStore => s !== null);
    return { stores, stdrYm: clean(fc.stdrYm) };
  } catch {
    return null;
  }
}
