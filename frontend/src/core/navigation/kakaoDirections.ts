import type { GeoPoint } from '../types/place';

const routePoint = (name: string, point: GeoPoint) =>
  `${encodeURIComponent(name)},${point.lat},${point.lng}`;

/** 현재 위치에서 가게까지 카카오맵 도보 길찾기를 여는 공식 링크 형식. */
export function kakaoWalkingDirectionsUrl(start: GeoPoint, destination: GeoPoint, destinationName: string): string {
  return `https://map.kakao.com/link/by/walk/${routePoint('현재 위치', start)}/${routePoint(destinationName, destination)}`;
}

/** 브라우저 GPS를 Promise 형태로 읽는다. 좌표는 서버나 DB에 저장하지 않는다. */
export function getCurrentPoint(): Promise<GeoPoint> {
  if (!navigator.geolocation) return Promise.reject(new Error('unsupported'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export function locationErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? Number(error.code) : 0;
  if (code === 1) return '위치 권한을 허용해야 현 위치에서 길찾기를 시작할 수 있어요.';
  if (code === 3) return '현재 위치 확인 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.';
  return '현재 위치를 확인하지 못했어요. 기기의 위치 설정을 확인해 주세요.';
}
