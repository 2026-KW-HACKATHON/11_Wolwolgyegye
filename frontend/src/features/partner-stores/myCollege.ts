import { useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { getSupabaseClient } from '../../core/supabase/client';
import { COLLEGES } from './colleges';
import type { CollegeKey } from './types';

/**
 * 사용자가 등록한 "내 단과대".
 * DB 에는 profiles.college_id(→ partners.id)로 저장하고, 화면은 단과대 이름으로 CollegeKey 와 잇는다.
 * 로그인한 사용자만 등록할 수 있다.
 */

let partnerIdsJob: Promise<Map<CollegeKey, string>> | null = null;

/** 단과대 key → partners.id. 앱이 켜져 있는 동안 한 번만 읽는다 (실패하면 다음에 다시) */
function fetchPartnerIds(): Promise<Map<CollegeKey, string>> {
  partnerIdsJob ??= (async () => {
    const { data, error } = await getSupabaseClient().from('partners').select('id, name');
    if (error) throw error;
    const keyByName = new Map(COLLEGES.map((c) => [c.name, c.key]));
    const result = new Map<CollegeKey, string>();
    for (const row of (data ?? []) as { id: string; name: string }[]) {
      const key = keyByName.get(row.name);
      if (key) result.set(key, row.id);
    }
    return result;
  })().catch((error) => {
    partnerIdsJob = null;
    throw error;
  });
  return partnerIdsJob;
}

/** 내 단과대를 바꾼다. null 이면 등록 해제 */
export async function saveMyCollege(userId: string, college: CollegeKey | null): Promise<void> {
  const collegeId = college ? (await fetchPartnerIds()).get(college) : null;
  if (college && !collegeId) throw new Error('unknown college');
  const { error } = await getSupabaseClient().from('profiles').update({ college_id: collegeId }).eq('user_id', userId);
  if (error) throw error;
}

/** 로그인한 사용자의 내 단과대. 등록 안 했거나, 손님이거나, 아직 읽는 중이면 null */
export function useMyCollege(): CollegeKey | null {
  const { collegeId } = useAuth();
  const [college, setCollege] = useState<CollegeKey | null>(null);

  useEffect(() => {
    if (!collegeId) {
      setCollege(null);
      return;
    }
    let cancelled = false;
    fetchPartnerIds()
      .then((ids) => {
        if (cancelled) return;
        const found = [...ids].find(([, id]) => id === collegeId);
        setCollege(found ? found[0] : null);
      })
      .catch(() => { if (!cancelled) setCollege(null); });
    return () => { cancelled = true; };
  }, [collegeId]);

  return college;
}
