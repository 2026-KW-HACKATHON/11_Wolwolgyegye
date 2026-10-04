/**
 * 계정 상태
 * - checking : 토큰 확인 중 (스플래시 표시)
 * - guest    : 비로그인
 * - customer : 로그인한 주민 또는 승인 대기 중인 사장님 신청자
 * - owner    : 본인 소유 가게가 있는 사용자
 */
export type AuthStatus = 'checking' | 'guest' | 'customer' | 'owner';
