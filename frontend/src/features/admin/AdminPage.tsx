import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAdminDashboard,
  rejectApplication,
  reviewWithExistingStore,
  setStorePublished,
  type AdminOwnerApplication,
  type AdminStore,
} from './adminApi';
import './admin.css';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBusinessNumber(value: string): string {
  return value.replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3');
}

function ApplicationCard({ application, onChanged }: {
  application: AdminOwnerApplication;
  onChanged: () => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  function approveExisting(event: FormEvent) {
    event.preventDefault();
    const requestedStoreId = application.requested_store_id;
    if (!requestedStoreId) {
      setError('기존 방식으로 접수된 신청이라 승인할 수 없어요. 반려 후 새 방식으로 다시 신청받아 주세요.');
      return;
    }
    void run(() => reviewWithExistingStore(application.id, requestedStoreId, note.trim()));
  }

  function reject(event: FormEvent) {
    event.preventDefault();
    if (!rejectNote.trim()) { setError('반려 이유를 입력해 주세요.'); return; }
    void run(() => rejectApplication(application.id, rejectNote.trim()));
  }

  return <article className="ad-application">
    <header><div><span>신청자</span><h3>{application.applicant_name}</h3><p>{application.applicant_email ?? '이메일 없음'} · {application.contact_phone}</p></div><time>{formatDate(application.created_at)}</time></header>
    <dl><div><dt>DB 등록 가게</dt><dd>{application.store_name}</dd></div><div><dt>주소</dt><dd>{application.store_address}</dd></div><div><dt>가게 등록 전화</dt><dd>{application.requested_store_phone || '등록된 전화번호 없음'}</dd></div><div><dt>사업자등록번호</dt><dd>{application.business_registration_number ? formatBusinessNumber(application.business_registration_number) : '기존 신청 · 재신청 필요'}</dd></div></dl>

    <details open>
      <summary>선택한 가게의 사장님으로 승인</summary>
      <form onSubmit={approveExisting} className="ad-form">
        <p className="ad-help">{application.requested_store_id ? '신청자 연락처, 가게 등록 전화번호, 사업자등록번호를 대조한 뒤 승인해 주세요. 승인 시 신청자가 선택한 이 가게에만 권한이 연결됩니다.' : '이 신청은 가게 선택 기능을 넣기 전에 접수됐습니다. 반려 후 DB에 등록된 실제 가게를 선택해 다시 신청받아 주세요.'}</p>
        <label>관리자 메모<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="선택 사항" /></label>
        <button type="submit" disabled={busy || !application.requested_store_id}>사장님 승인</button>
      </form>
    </details>

    <details>
      <summary>신청 반려</summary>
      <form onSubmit={reject} className="ad-form ad-reject">
        <label>반려 이유<textarea required rows={2} maxLength={500} value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} /></label>
        <button type="submit" disabled={busy}>반려하기</button>
      </form>
    </details>
    {error && <p className="ad-error" role="alert">{error}</p>}
  </article>;
}

export default function AdminPage() {
  const [applications, setApplications] = useState<AdminOwnerApplication[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changingStore, setChangingStore] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError('');
    try {
      const data = await fetchAdminDashboard();
      setApplications(data.applications);
      setStores(data.stores);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '관리자 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const pending = applications.filter((application) => application.status === 'pending');
  const visibleStores = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return stores.filter((store) => !term || [store.name, store.address, store.cuisine_type ?? ''].join(' ').toLocaleLowerCase().includes(term)).slice(0, 100);
  }, [query, stores]);

  async function togglePublished(store: AdminStore) {
    if (changingStore) return;
    setChangingStore(store.id);
    setError('');
    try {
      await setStorePublished(store.id, !store.is_published);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '가게 상태를 바꾸지 못했어요.');
    } finally {
      setChangingStore(null);
    }
  }

  return <main className="ad-page">
    <header className="ad-top"><div><span>WOLWOLGYEGYE ADMIN</span><h1>운영 관리자</h1><p>사장님 신청을 검토하고 공개할 가게를 관리합니다.</p></div><nav><Link to="/recommend">서비스 화면</Link><Link to="/login">내 계정</Link></nav></header>
    {error && <p className="ad-page-error" role="alert">{error}<button type="button" onClick={() => void reload()}>다시 불러오기</button></p>}
    <section className="ad-section" aria-labelledby="applications-title">
      <div className="ad-heading"><div><span>OWNER APPLICATIONS</span><h2 id="applications-title">사장님 가입 신청</h2></div><b>{pending.length}건 대기</b></div>
      {loading ? <p className="ad-empty">신청 목록을 불러오는 중입니다.</p> : pending.length === 0 ? <p className="ad-empty">대기 중인 신청이 없습니다.</p> : <div className="ad-application-list">{pending.map((application) => <ApplicationCard key={application.id} application={application} onChanged={reload} />)}</div>}
    </section>

    <section className="ad-section" aria-labelledby="stores-title">
      <div className="ad-heading"><div><span>STORE DIRECTORY</span><h2 id="stores-title">가게 공개 관리</h2></div><b>전체 {stores.length}곳</b></div>
      <label className="ad-search">가게 검색<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="가게명·주소·업종" /></label>
      <p className="ad-help">검색 결과는 최대 100곳까지 표시됩니다. 공개된 가게만 일반 사용자 화면에 나타납니다.</p>
      <div className="ad-store-list">{visibleStores.map((store) => <article key={store.id} className="ad-store"><div><h3>{store.name}</h3><p>{store.cuisine_type ? `${store.cuisine_type} · ` : ''}{store.address}</p><small>{store.owner_id ? '사장님 연결됨' : '사장님 미연결'}{store.is_demo ? ' · 예시' : ''}</small></div><button type="button" className={store.is_published ? 'is-public' : ''} aria-pressed={store.is_published} disabled={changingStore === store.id || store.is_demo} onClick={() => void togglePublished(store)}>{changingStore === store.id ? '변경 중…' : store.is_published ? '공개 중' : '비공개'}</button></article>)}</div>
    </section>
  </main>;
}
