import { useEffect, useMemo, useState } from 'react';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import { useFavoriteStores } from '../../shared/favorites/useFavoriteStores';
import Sheet from '../../shared/sheet/Sheet';
import { COLLEGES } from './mock';
import { fetchPartnerStores } from './source';
import type { CollegeKey, PartnerStoreView } from './types';
import '../../shared/store-list/store-list.css';
import './partner.css';

const SORTS = [
  { key: 'near', label: '가까운순' },
  { key: 'name', label: '이름순' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];
const TONES = ['blue', 'teal', 'purple', 'green', 'orange', 'rose'] as const;

function toneOf(storeId: string) {
  let hash = 0;
  for (const ch of storeId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

export default function PartnerStoresPage() {
  const active = usePageActive();
  const { isFavorite, toggle } = useFavoriteStores();
  const [stores, setStores] = useState<PartnerStoreView[] | null>(null);
  const [college, setCollege] = useState<CollegeKey>('eie');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('near');
  const [selected, setSelected] = useState<PartnerStoreView | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPartnerStores().then((list) => { if (!cancelled) setStores(list); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (!active) setSelected(null); }, [active]);

  const current = COLLEGES.find((c) => c.key === college)!;

  const visible = useMemo(() => {
    if (!stores) return [];
    const q = query.trim().toLocaleLowerCase();
    const list = stores.filter(
      (v) => v.benefits[college] && `${v.store.name} ${v.store.cuisineType ?? ''}`.toLocaleLowerCase().includes(q),
    );
    return sort === 'name'
      ? list.sort((a, b) => a.store.name.localeCompare(b.store.name, 'ko'))
      : list.sort((a, b) => a.walkMinutes - b.walkMinutes);
  }, [stores, college, query, sort]);

  return (
    <div className="pt-page">
      <section className="sl-hero">
        <span className="sl-hero-badge">🎓 광운대 학생을 위한 혜택</span>
        <h1 className="sl-hero-heading">우리 단과대 <em>제휴 가게</em>를 한눈에</h1>
        <p className="sl-hero-sub">소속 단과대를 고르면, 학생증으로 혜택을 받는 가게가 보여요.</p>
        <span className="sl-hero-mark" aria-hidden="true">❖</span>
      </section>

      <div className="pt-colleges" role="group" aria-label="단과대학 선택">
        {COLLEGES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`sl-chip pt-college${college === c.key ? ' is-on' : ''}`}
            aria-pressed={college === c.key}
            aria-label={c.name}
            title={c.name}
            onClick={() => setCollege(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <label className="sl-search">
        <span aria-hidden="true">🔍</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="가게 이름으로 찾아보세요" aria-label="제휴 가게 검색" />
      </label>

      <section className="pt-list">
        <div className="sl-list-head">
          <div>
            <h2 className="sl-list-title">{current.name} 제휴 가게</h2>
            <p className="sl-list-sub" aria-live="polite">
              {stores === null ? '제휴 가게를 불러오는 중이에요…' : <><b>{visible.length}</b>곳에서 혜택을 받을 수 있어요</>}
            </p>
          </div>
          <label className="sl-sort">
            <span className="sl-sort-label">정렬</span>
            <select className="sl-sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>

        {stores !== null && visible.length === 0 && (
          <div className="sl-empty">
            <p>{query ? '검색어에 맞는 제휴 가게가 없어요.' : '아직 등록된 제휴 가게가 없어요.'}</p>
            {query && <button type="button" className="sl-link" onClick={() => setQuery('')}>검색어 지우기</button>}
          </div>
        )}

        {visible.length > 0 && (
          <ul className="sl-grid">
            {visible.map((v) => {
              const fav = isFavorite(v.storeId);
              return (
                <li key={v.storeId} className={`sl-card sl-tone-${toneOf(v.storeId)}`}>
                  <button type="button" className="sl-card-main" onClick={() => setSelected(v)} aria-label={`${v.store.name} ${current.name} 제휴 혜택 보기`}>
                    <span className="sl-card-top">
                      <span className="sl-pill">{current.label} 학생 혜택</span>
                      <span className="pt-benefit">{v.benefits[college]}</span>
                    </span>
                    <span className="sl-card-body">
                      <span className="sl-card-meta">{v.store.cuisineType ?? '동네 가게'} · 도보 {v.walkMinutes}분</span>
                      <span className="sl-card-name">{v.store.name}</span>
                      <span className="sl-card-desc">{v.condition}</span>
                      <span className="pt-tags" aria-label="제휴 단과대">
                        {COLLEGES.filter((c) => v.benefits[c.key]).map((c) => (
                          <span key={c.key} className={c.key === college ? 'is-on' : ''}>{c.label}</span>
                        ))}
                      </span>
                    </span>
                  </button>
                  <div className="sl-card-foot">
                    <button type="button" className={`sl-like${fav ? ' is-on' : ''}`} aria-pressed={fav} aria-label={`${v.store.name} 찜 ${fav ? '해제' : '하기'}`} onClick={() => toggle(v.storeId)}>
                      {fav ? '♥ 찜함' : '♡ 찜하기'}
                    </button>
                    <span className="sl-card-go" aria-hidden="true">혜택 자세히</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="sl-tip"><b>🎓 이용 전에 확인하세요</b> 제휴 내용은 각 단과대 학생회 공지를 기준으로 해요. 결제 전에 학생증을 보여주세요.</p>
      <p className="sl-demo">가게·제휴 혜택은 예시입니다. 이 서비스는 광운대학교에서 운영하는 서비스가 아닙니다.</p>

      <Sheet open={!!selected && active} title="제휴 혜택 안내" onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className={`pt-sheet-top sl-tone-${toneOf(selected.storeId)}`}>
              <span className="sl-pill">{current.name} 학생 혜택</span>
              <strong>{selected.benefits[college]}</strong>
            </div>
            <h3 className="sl-sheet-lead">{selected.store.name}</h3>
            <p className="sl-sheet-copy">{selected.store.cuisineType ?? '동네 가게'} · 도보 {selected.walkMinutes}분</p>
            <ul className="pt-sheet-info">
              <li>✔ {selected.condition}</li>
              <li>📍 {selected.store.address}</li>
              <li>🕒 {selected.store.businessHours}</li>
              <li>📞 {selected.store.phone}</li>
            </ul>
            <p className="sl-sheet-note">가게와 혜택은 예시입니다. 혜택 적용 여부는 방문 전 단과대 학생회 공지나 가게에 확인해 주세요.</p>
            <button type="button" className="sl-primary" onClick={() => setSelected(null)}>확인</button>
          </>
        )}
      </Sheet>
    </div>
  );
}
