import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  createStoreAndApprove,
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

function ApplicationCard({ application, availableStores, onChanged }: {
  application: AdminOwnerApplication;
  availableStores: AdminStore[];
  onChanged: () => Promise<void>;
}) {
  const [storeId, setStoreId] = useState('');
  const [name, setName] = useState(application.store_name);
  const [address, setAddress] = useState(application.store_address);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [cuisineType, setCuisineType] = useState('');
  const [phone, setPhone] = useState(application.contact_phone);
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
    if (!storeId) { setError('연결할 가게를 선택해 주세요.'); return; }
    void run(() => reviewWithExistingStore(application.id, storeId, note.trim()));
  }

  function approveNew(event: FormEvent) {
    event.preventDefault();
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setError('위도와 경도를 숫자로 입력해 주세요.');
      return;
    }
    void run(() => createStoreAndApprove(application.id, {
      name: name.trim(), address: address.trim(), lat: parsedLat, lng: parsedLng,
      cuisineType: cuisineType.trim(), phone: phone.trim(), note: note.trim(),
    }));
  }

  function reject(event: FormEvent) {
    event.preventDefault();
    if (!rejectNote.trim()) { setError('반려 이유를 입력해 주세요.'); return; }
    void run(() => rejectApplication(application.id, rejectNote.trim()));
  }

  return <article className="ad-application">
    <header><div><span>신청자</span><h3>{application.applicant_name}</h3><p>{application.applicant_email ?? '이메일 없음'} · {application.contact_phone}</p></div><time>{formatDate(application.created_at)}</time></header>
    <dl><div><dt>신청 가게</dt><dd>{application.store_name}</dd></div><div><dt>신청 주소</dt><dd>{application.store_address}</dd></div></dl>

    <details open>
      <summary>기존 DB 가게와 연결해 승인</summary>
      <form onSubmit={approveExisting} className="ad-form">
        <label>가게 선택<select value={storeId} onChange={(event) => setStoreId(event.target.value)} required><option value="">선택해 주세요</option>{availableStores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.address}</option>)}</select></label>
        <label>관리자 메모<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="선택 사항" /></label>
        <button type="submit" disabled={busy}>기존 가게 연결 승인</button>
      </form>
    </details>

    <details>
      <summary>새 가게를 만들어 승인</summary>
      <form onSubmit={approveNew} className="ad-form ad-form--grid">
        <label>가게 이름<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>업종<input maxLength={100} value={cuisineType} onChange={(event) => setCuisineType(event.target.value)} placeholder="예: 한식" /></label>
        <label className="ad-span">주소<input required maxLength={300} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        <label>위도<input required inputMode="decimal" value={lat} onChange={(event) => setLat(event.target.value)} placeholder="37.6195" /></label>
        <label>경도<input required inputMode="decimal" value={lng} onChange={(event) => setLng(event.target.value)} placeholder="127.0595" /></label>
        <label>전화번호<input maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>관리자 메모<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="선택 사항" /></label>
        <p className="ad-span ad-help">새 가게는 비공개로 생성됩니다. 내용을 검토한 뒤 아래 가게 관리에서 공개하세요.</p>
        <button className="ad-span" type="submit" disabled={busy}>새 가게 생성 및 승인</button>
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
  const availableStores = stores.filter((store) => !store.owner_id && !store.is_demo);
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
      {loading ? <p className="ad-empty">신청 목록을 불러오는 중입니다.</p> : pending.length === 0 ? <p className="ad-empty">대기 중인 신청이 없습니다.</p> : <div className="ad-application-list">{pending.map((application) => <ApplicationCard key={application.id} application={application} availableStores={availableStores} onChanged={reload} />)}</div>}
    </section>

    <section className="ad-section" aria-labelledby="stores-title">
      <div className="ad-heading"><div><span>STORE DIRECTORY</span><h2 id="stores-title">가게 공개 관리</h2></div><b>전체 {stores.length}곳</b></div>
      <label className="ad-search">가게 검색<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="가게명·주소·업종" /></label>
      <p className="ad-help">검색 결과는 최대 100곳까지 표시됩니다. 공개된 가게만 일반 사용자 화면에 나타납니다.</p>
      <div className="ad-store-list">{visibleStores.map((store) => <article key={store.id} className="ad-store"><div><h3>{store.name}</h3><p>{store.cuisine_type ? `${store.cuisine_type} · ` : ''}{store.address}</p><small>{store.owner_id ? '사장님 연결됨' : '사장님 미연결'}{store.is_demo ? ' · 데모' : ''}</small></div><button type="button" className={store.is_published ? 'is-public' : ''} aria-pressed={store.is_published} disabled={changingStore === store.id || store.is_demo} onClick={() => void togglePublished(store)}>{changingStore === store.id ? '변경 중…' : store.is_published ? '공개 중' : '비공개'}</button></article>)}</div>
    </section>
  </main>;
}
