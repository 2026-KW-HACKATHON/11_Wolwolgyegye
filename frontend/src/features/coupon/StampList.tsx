import { useMemo } from 'react';
import Icon from '../../shared/Icon';
import ExtraIcon from '../../shared/ExtraIcon';
import { useFavoriteStores } from '../../shared/favorites/useFavoriteStores';
import { STAMP_FILTERS, STAMP_SORTS, initialOf, isReady, relativeDay, remainingOf, statusText, tiltOf, rewardsOf, progressOf, MAX_STAMP_SLOTS } from './constants';
import type { StampFilter, StampSort, StampView } from './types';

interface Props {
  stamps: StampView[] | null;
  error: boolean;
  onRetry: () => void;
  missingId: string | null;
  query: string;
  onQuery: (value: string) => void;
  filter: StampFilter;
  onFilter: (value: StampFilter) => void;
  sort: StampSort;
  onSort: (value: StampSort) => void;
  onOpen: (storeId: string) => void;
  onResetDemo: () => void;
}

export default function StampList({ stamps, error, onRetry, missingId, query, onQuery, filter, onFilter, sort, onSort, onOpen, onResetDemo }: Props) {
  const { isFavorite, toggle } = useFavoriteStores();
  const all = useMemo(() => stamps ?? [], [stamps]);

  const ready = all.filter(isReady);
  const collecting = all.filter((v) => v.count > 0 && !isReady(v));
  const totalRewards = all.reduce((sum, v) => sum + rewardsOf(v), 0);
  const hasDemo = all.some((v) => v.history.some((t) => t.origin === 'demo'));
  const counts: Record<StampFilter, number> = {
    all: all.length,
    ready: ready.length,
    collecting: collecting.length,
    saved: all.filter((v) => isFavorite(v.storeId)).length,
  };

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = all.filter((v) => {
      if (filter === 'ready' && !isReady(v)) return false;
      if (filter === 'collecting' && (v.count === 0 || isReady(v))) return false;
      if (filter === 'saved' && !isFavorite(v.storeId)) return false;
      return `${v.store.name} ${v.store.cuisineType ?? ''} ${v.reward}`.toLocaleLowerCase().includes(q);
    });
    const byName = (a: StampView, b: StampView) => a.store.name.localeCompare(b.store.name, 'ko');
    if (sort === 'name') return list.sort(byName);
    if (sort === 'near') return list.sort((a, b) => a.walkMinutes - b.walkMinutes || byName(a, b));
    if (sort === 'recent') return list.sort((a, b) => (Date.parse(b.lastActivityAt ?? '') || 0) - (Date.parse(a.lastActivityAt ?? '') || 0) || byName(a, b));
    // 선물 가까운순: 받을 수 있는 선물 → 남은 개수 적은 순 → 아직 시작 안 한 가게
    const rank = (v: StampView) => isReady(v) ? 0 : v.count > 0 ? 1 : 2;
    return list.sort((a, b) => rank(a) - rank(b) || remainingOf(a) - remainingOf(b) || byName(a, b));
  }, [all, filter, query, sort, isFavorite]); // isFavorite 는 찜 목록이 바뀌면 새 함수가 된다

  return (
    <>
      <section className="st-reward-summary" aria-labelledby="st-wallet-title">
        <Icon name="gift" />
        <h1 id="st-wallet-title" aria-live="polite">
          {error ? '받을 수 있는 선물 수를 확인하지 못했어요' : stamps
            ? <>받을 수 있는 선물 <em>{totalRewards}개</em></>
            : '받을 수 있는 선물 확인 중…'}
        </h1>
      </section>

      <div className="st-toolbar">
        <label className="st-search">
          <Icon name="search" />
          <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="가게·선물 이름으로 찾기" aria-label="스탬프 가게 검색" />
        </label>
        <label className="st-sort">
          <span className="st-sr">정렬</span>
          <select value={sort} onChange={(e) => onSort(e.target.value as StampSort)}>
            {STAMP_SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className="st-filters" role="group" aria-label="적립 상태">
        {STAMP_FILTERS.map((f) => (
          <button key={f.key} type="button" className={filter === f.key ? 'is-on' : ''} aria-pressed={filter === f.key} onClick={() => onFilter(f.key)}>
            {f.label}<span>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <section aria-labelledby="st-list-title">
        <div className="st-list-head">
          <h2 id="st-list-title">스탬프 가게</h2>
          <p aria-live="polite">{error ? '불러오지 못했어요' : stamps === null ? '불러오는 중…' : <><b>{visible.length}</b>곳</>}</p>
        </div>

        {missingId && <p className="st-inline-note" role="status">선택한 가게의 적립판을 찾을 수 없어 목록을 보여드려요.</p>}

        {error && (
          <div className="st-empty">
            <strong>스탬프 정보를 불러오지 못했어요</strong>
            <p>잠시 후 다시 시도해 주세요.</p>
            <button type="button" className="st-btn st-btn--line" onClick={onRetry}>다시 불러오기</button>
          </div>
        )}

        {!error && stamps === null && <ul className="st-grid" aria-hidden="true">{[0, 1, 2].map((n) => <li key={n} className="st-skeleton" />)}</ul>}

        {stamps !== null && visible.length === 0 && !error && (
          <div className="st-empty">
            <strong>{filter === 'ready' ? '아직 받을 수 있는 선물이 없어요' : filter === 'saved' ? '찜한 스탬프 가게가 없어요' : '조건에 맞는 가게가 없어요'}</strong>
            <p>{filter === 'ready' ? '조금만 더 모으면 돼요. 선물까지 가까운 가게부터 볼까요?' : '다른 조건으로 찾아보세요.'}</p>
            <button type="button" className="st-btn st-btn--line" onClick={() => { onFilter('all'); onQuery(''); onSort('closest-reward'); }}>전체 가게 보기</button>
          </div>
        )}

        {visible.length > 0 && (
          <ul className="st-grid">
            {visible.map((v) => {
              const done = isReady(v);
              const fav = isFavorite(v.storeId);
              return (
                <li key={v.storeId} className={`st-item${done ? ' is-ready' : ''}${v.count === 0 ? ' is-new' : ''}`}>
                  <button type="button" className="st-item-main" onClick={() => onOpen(v.storeId)}
                    aria-label={`${v.store.name} 적립판 열기. ${v.requiredStamps}개 중 ${v.count}개 적립, ${statusText(v)}`}>
                    <span className="st-item-head">
                      <span className="st-avatar" aria-hidden="true">{initialOf(v.store.name)}</span>
                      <span className="st-item-title">
                        <span className="st-item-meta">{v.store.cuisineType ?? '생활·문화'} · 도보 {v.walkMinutes}분</span>
                        <strong>{v.store.name}</strong>
                      </span>
                    </span>
                    {v.requiredStamps <= MAX_STAMP_SLOTS ? <span className="st-meter" style={{ gridTemplateColumns: `repeat(${Math.min(v.requiredStamps, 10)}, minmax(0, 1fr))` }} aria-hidden="true">
                      {Array.from({ length: v.requiredStamps }, (_, i) => {
                        const on = i < v.count;
                        const gift = i === v.requiredStamps - 1;
                        return (
                          <i key={i} className={`${on ? 'is-on' : ''}${gift ? ' is-gift' : ''}`} style={on ? { rotate: `${tiltOf(v.storeId, i)}deg` } : undefined}>
                            {gift && !on ? <Icon name="gift" /> : null}
                          </i>
                        );
                      })}
                    </span> : <span className="st-progress st-meter-progress" aria-hidden="true"><span style={{ width: `${progressOf(v)}%` }} /></span>}
                    <span className="st-item-row">
                      <span className="st-item-count"><b>{v.count}</b> / {v.requiredStamps}</span>
                      <span className={`st-badge${done ? ' is-ready' : v.count === 0 ? ' is-new' : ''}`}>{statusText(v)}</span>
                    </span>
                    <span className="st-item-reward">
                      <Icon name="gift" />
                      <span className="st-item-reward-text"><b>{v.reward}</b>{v.lastActivityAt ? <small>최근 적립 {relativeDay(v.lastActivityAt)}</small> : <small>{v.unit} 시 적립</small>}</span>
                    </span>
                  </button>
                  <button type="button" className={`st-heart${fav ? ' is-on' : ''}`} aria-pressed={fav} aria-label={`${v.store.name} 찜 ${fav ? '해제' : '하기'}`} onClick={() => toggle(v.storeId)}>
                    <Icon name="heart" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="st-how" aria-labelledby="st-how-title">
        <h2 id="st-how-title">스탬프는 이렇게 모여요</h2>
        <ol>
          <li><span className="st-how-icon"><ExtraIcon name="qr" /></span><b>적립 코드 보여주기</b><span>결제할 때 가게 적립판의 ‘적립 코드’를 직원에게 보여주세요.</span></li>
          <li><span className="st-how-icon"><ExtraIcon name="check" /></span><b>직원이 확인</b><span>직원이 사장님 화면에서 코드를 확인하면 바로 적립돼요.</span></li>
          <li><span className="st-how-icon"><Icon name="gift" /></span><b>다 모으면 선물</b><span>정해진 개수를 채우면 교환권을 보여주고 상품을 받아요.</span></li>
        </ol>
      </section>

      <p className="st-demo-note">
        시연으로 찍은 도장은 이 브라우저에만 저장돼요.
        {hasDemo && <button type="button" onClick={onResetDemo}>시연 기록 지우기</button>}
      </p>
    </>
  );
}
