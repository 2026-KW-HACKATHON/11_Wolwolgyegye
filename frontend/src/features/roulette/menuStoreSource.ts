import { MENU_STORES, type MenuStore } from './rouletteData';

/**
 * 룰렛에서 뽑힌 메뉴로 추천 가게를 찾아오는 지점.
 *
 * 지금은 예시 데이터에서 이름이 같은 가게를 골라 주지만, 백엔드가 준비되면
 * 이 함수 안만 아래처럼 바꾸면 화면 코드는 그대로 둬도 된다.
 *
 *   const res = await fetch(`/api/stores?menu=${encodeURIComponent(menuName)}`);
 *   return res.json();
 */
export async function fetchStoresByMenu(menuName: string): Promise<MenuStore[]> {
  return MENU_STORES.filter((store) => store.menuName === menuName);
}
