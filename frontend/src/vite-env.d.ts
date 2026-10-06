/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** 카카오맵 JavaScript 키 (공개용, 사이트 도메인을 등록해 둔 것). 팀에서 쓰던 지도 키와 같은 이름. 없으면 카카오 장소 정보를 쓰지 않는다 */
  readonly VITE_KAKAO_MAP_KEY?: string;
}
