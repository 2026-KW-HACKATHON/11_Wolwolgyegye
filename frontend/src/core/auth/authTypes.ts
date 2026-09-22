/**
 * 계정 상태
 * - checking : 토큰 확인 중 (스플래시 표시)
 * - guest    : 비로그인
 * - customer : 손님 (추후)
 * - owner    : 사장님 (추후, /owner/... 라우트 영역)
 */
export type AuthStatus = 'checking' | 'guest' | 'customer' | 'owner';