import { useCallback, useEffect, useState } from 'react';

/**
 * 가게 찜(관심) 목록. 스탬프·제휴 가게 화면이 함께 쓰며, 같은 가게는 어느 화면에서 찜해도 같이 바뀐다.
 * 로그인 연동 전까지는 이 브라우저의 localStorage 에만 저장한다.
 */
const KEY = 'wol-favorite-stores';
const EVENT = 'wol-favorite-stores';

function load(): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function useFavoriteStores() {
  const [ids, setIds] = useState<string[]>(load);

  useEffect(() => {
    const sync = () => setIds(load());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const toggle = useCallback((storeId: string) => {
    const current = load();
    const next = current.includes(storeId) ? current.filter((v) => v !== storeId) : [...current, storeId];
    setIds(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* 저장 실패해도 이번 세션 동작에는 지장 없음 */
    }
  }, []);

  return { isFavorite: (storeId: string) => ids.includes(storeId), toggle };
}
