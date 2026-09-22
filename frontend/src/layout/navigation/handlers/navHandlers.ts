import type { PageMeta } from '../../../core/categories/categoryTypes';

/**
 * 네비게이션 이벤트 핸들러 규격.
 * PC 세트와 터치(모바일/태블릿) 세트가 같은 규격을 구현하고, useNavHandlers 가 기기 모드에 따라 골라준다.
 * 지금은 뼈대만 있고 실제 동작은 화면 이동(onSelect) 뿐이다.
 */
export interface NavHandlers {
  /** 항목 선택 (클릭/탭). go 는 경로 이동 함수 */
  onSelect: (target: PageMeta, go: (path: string) => void) => void;
  /** PC 전용: 마우스 올림/내림 (미리보기 등 추후 확장 자리) */
  onHoverStart?: (target: PageMeta) => void;
  onHoverEnd?: (target: PageMeta) => void;
  /** 터치 전용: 길게 누르기 (추후 확장 자리, 이벤트 연결은 아직 안 함) */
  onLongPress?: (target: PageMeta) => void;
}