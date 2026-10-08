import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue, type OwnerApplication } from '../../core/auth/AuthContext';
import { getSupabaseClient } from '../../core/supabase/client';

type AuthSnapshot = Pick<AuthContextValue, 'status' | 'userId' | 'userName' | 'collegeId' | 'email' | 'hasEmailLogin' | 'emailVerified' | 'isAdmin' | 'ownedStores' | 'ownerApplication' | 'error'>;

const GUEST: AuthSnapshot = {
  status: 'guest', userId: null, userName: null, collegeId: null, email: null,
  hasEmailLogin: false, emailVerified: false, isAdmin: false,
  ownedStores: [], ownerApplication: null, error: null,
};

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({ ...GUEST, status: 'checking' });
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const client = getSupabaseClient();
      const { data: { session } } = await client.auth.getSession();
      if (current !== revision.current) return;
      if (!session) {
        setSnapshot(GUEST);
        return;
      }
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (current !== revision.current) return;
      if (userError || !user) {
        setSnapshot({ ...GUEST, error: userError && userError.status !== 401 ? '로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.' : null });
        return;
      }

      const [profile, college, stores, applications, admin] = await Promise.all([
        client.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
        // 내 단과대는 따로 읽는다: 칸이 아직 없는 DB 에서도 이름·사장님 정보는 그대로 불러오도록
        client.from('profiles').select('college_id').eq('user_id', user.id).maybeSingle(),
        client.from('stores').select('id, name').eq('owner_id', user.id),
        client.from('owner_applications').select('status, review_note, store_name').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        client.rpc('is_current_user_admin'),
      ]);
      if (current !== revision.current) return;
      const ownedStores = stores.error ? [] : (stores.data ?? []) as { id: string; name: string }[];
      setSnapshot({
        status: ownedStores.length ? 'owner' : 'customer',
        userId: user.id,
        userName: profile.data?.display_name ?? user.user_metadata?.display_name ?? '월계 주민',
        collegeId: college.error ? null : (college.data as { college_id: string | null } | null)?.college_id ?? null,
        email: user.email ?? null,
        hasEmailLogin: user.identities?.some((identity) => identity.provider === 'email') ??
          (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes('email')),
        emailVerified: Boolean(user.email_confirmed_at),
        isAdmin: admin.error ? false : admin.data === true,
        ownedStores,
        ownerApplication: applications.error ? null : (applications.data?.[0] as OwnerApplication | undefined) ?? null,
        error: profile.error || stores.error || applications.error || admin.error ? '계정 정보를 일부 불러오지 못했어요. 새로고침해 주세요.' : null,
      });
    } catch {
      if (current === revision.current) setSnapshot({ ...GUEST, error: '인증 연결을 확인해 주세요.' });
    }
  }, []);

  useEffect(() => {
    let client;
    try {
      client = getSupabaseClient();
    } catch {
      setSnapshot({ ...GUEST, error: '로그인 설정이 아직 준비되지 않았어요.' });
      return;
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
      // Auth 콜백 안에서 Supabase 쿼리를 바로 호출하면 잠길 수 있다.
      window.setTimeout(() => { void refresh(); }, 0);
    });
    void refresh();
    return () => { revision.current++; subscription.unsubscribe(); };
  }, [refresh]);

  const logout = useCallback(async () => {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
    revision.current++;
    setPasswordRecovery(false);
    setSnapshot(GUEST);
  }, []);

  return <AuthContext.Provider value={{ ...snapshot, passwordRecovery, finishPasswordRecovery: () => setPasswordRecovery(false), refresh, logout }}>{children}</AuthContext.Provider>;
}
