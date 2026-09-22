/** 화면(경로)을 가진 모든 항목의 최소 공통 정보 */
export interface PageMeta {
  id: string;
  name: string;
  path: string;
  /** ? 안내창에 표시할 기능 설명 */
  help: string;
}

/** 네비게이션에 나열되는 카테고리 */
export interface Category extends PageMeta {
  /** 아이콘 자리 (지금은 글자 하나짜리 임시 기호, 추후 아이콘으로 교체) */
  icon: string;
  /** true 면 사용자가 끌 수 없이 항상 노출 */
  isFixed: boolean;
  /** 고정 카테고리의 위치. 모바일 하단바에서 left=왼쪽 끝, right=오른쪽 끝 */
  fixedSide?: 'left' | 'right';
}