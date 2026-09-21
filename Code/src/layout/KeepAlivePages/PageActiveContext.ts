import { createContext, useContext } from 'react';

export const PageActiveContext = createContext<boolean>(true);

/**
 * 이 페이지가 지금 화면에 보이는 탭인지 알려주는 훅.
 * 탭은 숨겨질 뿐 언마운트되지 않으므로, "다시 보일 때 데이터 재요청"은
 * 각 페이지에서 이 값이 false -> true 로 바뀔 때 실행하면 된다. (데이터 연동 단계에서 사용)
 */
export function usePageActive(): boolean {
  return useContext(PageActiveContext);
}