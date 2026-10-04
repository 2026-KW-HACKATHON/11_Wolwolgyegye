import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DEFAULT_LANDING_PATH } from '../../core/categories/categories';
import { useAuth } from '../../core/auth/AuthContext';
import { getSupabaseClient } from '../../core/supabase/client';
import { useToast } from '../../shared/toast/ToastContext';
import './login.css';

type Mode = 'login' | 'customer-signup' | 'owner-signup' | 'reset';
const KAKAO_PROVIDER = 'custom:kakao-no-email' as const;

function authMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/Invalid login credentials/i.test(message)) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (/Email not confirmed/i.test(message)) return '이메일 인증을 마친 뒤 로그인해 주세요.';
  if (/already registered/i.test(message)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (/Password should/i.test(message)) return '비밀번호 조건을 확인해 주세요.';
  if (/provider.*(not enabled|disabled|unsupported)|unsupported provider/i.test(message)) return '카카오 로그인이 아직 설정되지 않았어요.';
  if (/rate limit/i.test(message)) return '잠시 후 다시 시도해 주세요.';
  return message || '요청을 처리하지 못했어요. 다시 시도해 주세요.';
}

export default function LoginPage() {
  const { status, userId, userName, email: accountEmail, hasEmailLogin, emailVerified, passwordRecovery, finishPasswordRecovery, ownedStores, ownerApplication, error: accountError, refresh, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const ownerIntent = searchParams.get('intent') === 'owner';
  const [ownerFlow, setOwnerFlow] = useState(false);
  const wantsOwner = ownerIntent || ownerFlow;
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const showToast = useToast();
  const navigate = useNavigate();

  function chooseMode(next: Mode) {
    setMode(next);
    setMessage('');
    setError('');
    if (next === 'owner-signup') setOwnerFlow(true);
    if (next === 'customer-signup') setOwnerFlow(false);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    setError('');
    try { await action(); }
    catch (cause) { setError(authMessage(cause)); }
    finally { setBusy(false); }
  }

  function handleKakao() {
    void run(async () => {
      const { error: oauthError } = await getSupabaseClient().auth.signInWithOAuth({
        provider: KAKAO_PROVIDER,
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (oauthError) throw oauthError;
    });
  }

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const client = getSupabaseClient();
      if (mode === 'reset') {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login`,
        });
        if (resetError) throw resetError;
        setMessage('비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.');
        return;
      }
      if (mode === 'login') {
        const { error: loginError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) throw loginError;
        await refresh();
        setPassword('');
        showToast('로그인했어요');
        if (!wantsOwner) navigate(DEFAULT_LANDING_PATH);
        return;
      }
      if (password !== confirmPassword) throw new Error('비밀번호가 서로 달라요.');
      const displayName = name.trim();
      if (!displayName) throw new Error('이름을 입력해 주세요.');
      const isOwner = mode === 'owner-signup';
      const { data, error: signupError } = await client.auth.signUp({
        email: email.trim(), password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/login${isOwner ? '?intent=owner' : ''}`,
        },
      });
      if (signupError) throw signupError;
      setPassword('');
      setConfirmPassword('');
      if (isOwner) setOwnerFlow(true);
      if (data.session) {
        await refresh();
        setMessage(isOwner ? '계정이 만들어졌어요. 아래에서 가게 정보를 제출해 주세요.' : '회원가입이 완료됐어요.');
        if (!isOwner) navigate(DEFAULT_LANDING_PATH);
      } else {
        setMessage('인증 메일을 보냈어요. 메일 속 링크로 인증한 뒤 로그인해 주세요.');
        setMode('login');
      }
    });
  }

  function handleApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    void run(async () => {
      const { error: insertError } = await getSupabaseClient().from('owner_applications').insert({
        user_id: userId,
        applicant_name: name.trim() || userName || '',
        contact_phone: phone.trim(),
        store_name: storeName.trim(),
        store_address: storeAddress.trim(),
      });
      if (insertError) throw insertError;
      await refresh();
      setMessage('사장님 신청을 접수했어요. 승인 결과는 여기에서 확인할 수 있어요.');
    });
  }

  function handleLogout() {
    void run(async () => {
      await logout();
      setMode('login');
      showToast('로그아웃했어요');
    });
  }

  function handleNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword('');
      finishPasswordRecovery();
      setMessage('비밀번호를 변경했어요.');
    });
  }

  if (status !== 'guest' && status !== 'checking') {
    return (
      <div className="lp-card">
        <div className="lp-user-badge">{(userName ?? '월').charAt(0)}</div>
        <h2 className="lp-title">{userName}님</h2>
        <p className="lp-sub">{accountEmail ?? '월계1동 이웃들과 함께하고 있어요'}</p>
        {accountError && <p className="lp-error" role="alert">{accountError}</p>}
        {passwordRecovery && <form className="lp-name-form lp-account-section" onSubmit={handleNewPassword}><h3>새 비밀번호 설정</h3><label>새 비밀번호<input className="lp-name-input" required type="password" minLength={6} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><button className="lp-submit" type="submit" disabled={busy}>비밀번호 변경</button></form>}
        {status === 'owner' && <div className="lp-account-section"><p>관리할 가게: {ownedStores.map((store) => store.name).join(', ')}</p><Link className="lp-link-button" to="/owner">사장님 화면 열기</Link></div>}
        {ownerApplication?.status === 'pending' && <div className="lp-account-section"><strong>사장님 승인 대기 중</strong><p>{ownerApplication.store_name} 신청을 검토하고 있어요.</p></div>}
        {ownerApplication?.status === 'rejected' && <div className="lp-account-section"><strong>이전 신청이 반려됐어요</strong><p>{ownerApplication.review_note || '입력 내용을 확인한 뒤 다시 신청해 주세요.'}</p></div>}
        {ownerApplication?.status === 'approved' && status !== 'owner' && <div className="lp-account-section"><p>승인된 신청은 있지만 현재 연결된 가게가 없어요. 운영자에게 문의해 주세요.</p></div>}
        {status !== 'owner' && ownerApplication?.status !== 'pending' && ownerApplication?.status !== 'approved' && (wantsOwner ? (
          hasEmailLogin && emailVerified ? <form className="lp-name-form lp-account-section" onSubmit={handleApplication}>
            <h3>사장님 신청</h3>
            <p className="lp-sub">가게 정보 제출 후 관리자 승인을 받아야 가게를 관리할 수 있어요.</p>
            <label>신청자 이름<input className="lp-name-input" required maxLength={80} value={name} placeholder={userName ?? ''} onChange={(event) => setName(event.target.value)} /></label>
            <label>연락처<input className="lp-name-input" required type="tel" minLength={8} maxLength={25} pattern="[0-9+() -]+" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label>가게 이름<input className="lp-name-input" required maxLength={100} value={storeName} onChange={(event) => setStoreName(event.target.value)} /></label>
            <label>가게 주소<input className="lp-name-input" required maxLength={300} value={storeAddress} onChange={(event) => setStoreAddress(event.target.value)} /></label>
            <button className="lp-submit" type="submit" disabled={busy}>신청 제출</button>
          </form> : <div className="lp-account-section"><p>{hasEmailLogin ? '이메일 인증을 마친 뒤 사장님 신청이 가능해요.' : '사장님 신청에는 인증된 이메일 계정이 필요해요. 이메일로 회원가입해 주세요.'}</p></div>
        ) : <button className="lp-logout" type="button" onClick={() => setOwnerFlow(true)}>사장님 신청하기</button>)}
        {message && <p className="lp-message" role="status">{message}</p>}
        {error && <p className="lp-error" role="alert">{error}</p>}
        <button type="button" className="lp-logout" disabled={busy} onClick={handleLogout}>로그아웃</button>
      </div>
    );
  }

  return (
    <div className="lp-card">
      <h2 className="lp-title">{mode === 'login' ? '로그인' : mode === 'reset' ? '비밀번호 재설정' : mode === 'owner-signup' ? '사장님 회원가입' : '일반 회원가입'}</h2>
      <p className="lp-sub">{mode === 'owner-signup' ? '이메일 인증 후 가게 정보를 제출해 주세요.' : '월계1동 이웃들과 더 가까워져요.'}</p>
      {mode === 'login' && <><div className="lp-provider-list"><button className="lp-provider-btn lp-provider--kakao" type="button" disabled={busy} onClick={handleKakao}>카카오로 간편로그인</button></div><div className="lp-divider"><span>또는 이메일로</span></div></>}
      <form className="lp-name-form" onSubmit={handleEmailSubmit}>
        {(mode === 'customer-signup' || mode === 'owner-signup') && <label>이름<input className="lp-name-input" required maxLength={40} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label>이메일<input className="lp-name-input" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {mode !== 'reset' && <label>비밀번호<input className="lp-name-input" required type="password" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
        {(mode === 'customer-signup' || mode === 'owner-signup') && <label>비밀번호 확인<input className="lp-name-input" required type="password" minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
        <button className="lp-submit" type="submit" disabled={busy}>{busy ? '처리 중…' : mode === 'login' ? '이메일 로그인' : mode === 'reset' ? '재설정 메일 보내기' : '회원가입'}</button>
      </form>
      {message && <p className="lp-message" role="status">{message}</p>}
      {(error || accountError) && <p className="lp-error" role="alert">{error || accountError}</p>}
      <div className="lp-actions">
        {mode !== 'login' && <button type="button" onClick={() => chooseMode('login')}>로그인으로 돌아가기</button>}
        {mode === 'login' && <><button type="button" onClick={() => chooseMode('customer-signup')}>일반 회원가입</button><button type="button" onClick={() => chooseMode('owner-signup')}>사장님 회원가입</button><button type="button" onClick={() => chooseMode('reset')}>비밀번호 찾기</button></>}
      </div>
    </div>
  );
}
