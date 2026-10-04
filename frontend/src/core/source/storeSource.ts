import { MAP_CENTER } from '../../shared/map/vworld/mapExtent';
import type { GeoPoint, Store } from '../types/place';

/**
 * 가게 공통 정보를 가져오는 지점. 모든 카테고리의 source.ts 가 이 함수로 storeId 를 가게로 바꾼다.
 * TODO(DB): stores 테이블 연결 전까지는 가게가 없다. (가짜 데이터를 쓰지 않는다)
 */
export async function fetchStoresByIds(ids: string[]): Promise<Map<string, Store>> {
  void ids;
  return new Map();
}

/** 지도에 카테고리 가게 핀으로 표시할 가게 목록. TODO(DB): stores 테이블 연결 */
export async function fetchStores(): Promise<Store[]> {
  return [];
}

/** 거리 계산 기준점. 위치 권한 연동 전까지는 월계1동 직사각형 가운데를 쓴다 */
export async function getUserLocation(): Promise<GeoPoint> {
  return MAP_CENTER;
}
