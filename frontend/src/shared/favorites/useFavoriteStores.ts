import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { getSupabaseClient } from '../../core/supabase/client';

/**
 * 가게 찜(관심) 목록. 스탬프·제휴 가게 화면이 함께 쓰며, 같은 가게는 어느 화면에서 찜해도 같이 바뀐다.
 * 로그인 사용자의 가게 찜을 Supabase store_favorites에서 공유한다.
 */
const EVENT = 'wol-favorite-stores';

export function useFavoriteStores() {
  const { userId } = useAuth();
  const [ids, setIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!userId) { setIds([]); return; }
    const { data, error } = await getSupabaseClient().from('store_favorites').select('store_id').eq('user_id', userId);
    if (!error) setIds((data ?? []).map((row) => row.store_id));
  }, [userId]);

  useEffect(() => {
    void load();
    const sync = () => { void load(); };
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [load]);

  const toggle = useCallback(async (storeId: string) => {
    if (!userId) return;
    const exists = ids.includes(storeId);
    setIds((current) => exists ? current.filter((id) => id !== storeId) : [...current, storeId]);
    const query = exists
      ? getSupabaseClient().from('store_favorites').delete().eq('user_id', userId).eq('store_id', storeId)
      : getSupabaseClient().from('store_favorites').insert({ user_id: userId, store_id: storeId });
    const { error } = await query;
    if (error) await load();
    else window.dispatchEvent(new Event(EVENT));
  }, [ids, load, userId]);

  return { isFavorite: (storeId: string) => ids.includes(storeId), toggle };
}
