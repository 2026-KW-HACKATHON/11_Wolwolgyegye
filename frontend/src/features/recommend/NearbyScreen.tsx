import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../shared/Icon';
import { useToast } from '../../shared/toast/ToastContext';
import { NEARBY_FILTERS, STORES, STORE_THUMB_BG } from './recommendData';

type SortKey = 'distance' | 'name';

export default function NearbyScreen({ onShowHome }: { onShowHome: () => void }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('distance');
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const showToast = useToast();

  const visibleStores = useMemo(() => {
    const list = STORES.filter((s) => filter === 'all' || s.categories.includes(filter));
    const sorted = [...list];
    if (sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else {
      sorted.sort((a, b) => parseInt(a.distance, 10) - parseInt(b.distance, 10));
    }
    return sorted;
  }, [filter, sort]);

  return (
    <div className="rp-nearby">
      <h2 className="rp-section-title">지금 만나는 동네 가게</h2>
      <p className="rp-section-subtitle">배우고, 만들고, 경험하는 월계1동의 특별한 하루</p>

      <div className="rp-filter-tabs">
        {NEARBY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`rp-filter-chip${filter === f.key ? ' is-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.icon && <Icon name={f.icon} />}
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      <div className="rp-map-placeholder" aria-hidden="true">
        <svg viewBox="0 0 400 190" preserveAspectRatio="none">
          <rect width="400" height="190" fill="var(--color-surface-alt)" />
          <path
            d="M270 -10 C 230 40, 300 90, 260 140 C 230 175, 260 200, 300 220"
            stroke="#bcd9ef"
            strokeWidth="26"
            fill="none"
            opacity="0.7"
          />
          <g stroke="var(--color-border)" strokeWidth="2">
            <path d="M0 60 H400" />
            <path d="M0 120 H400" />
            <path d="M90 0 V190" />
            <path d="M190 0 V190" />
          </g>
          <circle cx="55" cy="150" r="26" fill="#e3ecdc" />
          <circle cx="345" cy="45" r="20" fill="#e3ecdc" />
        </svg>
        <span className="rp-map-label" style={{ left: '8%', bottom: '8%' }}>
          월계근린공원
        </span>
        <span className="rp-map-label" style={{ right: '6%', top: '8%' }}>
          월계천
        </span>
        <button
          className="rp-map-locate-btn"
          type="button"
          onClick={() => showToast('현재 위치는 예시입니다')}
          aria-label="현재 위치"
        >
          <Icon name="compass" />
        </button>
        {STORES.map((store) => (
          <div
            key={store.id}
            className="rp-map-pin"
            style={{ left: store.position.left, top: store.position.top }}
          >
            <span className="rp-pin-badge">
              <Icon name={store.icon} />
            </span>
            <span className="rp-pin-label">{store.name}</span>
          </div>
        ))}
      </div>
      <p className="rp-map-caption">가게 · 거리 · 지도는 예시입니다</p>

      <div className="rp-list-panel">
        <div className="rp-list-header">
          <span className="rp-count">주변 가게 {visibleStores.length}곳</span>
          <div className="rp-sort-toggle">
            <button
              type="button"
              className={`rp-sort-btn${sort === 'distance' ? ' is-active' : ''}`}
              onClick={() => setSort('distance')}
            >
              거리순
            </button>
            <button
              type="button"
              className={`rp-sort-btn${sort === 'name' ? ' is-active' : ''}`}
              onClick={() => setSort('name')}
            >
              이름순
            </button>
          </div>
        </div>

        <ul className="rp-store-list">
          {visibleStores.map((store) => (
            <li key={store.id} className="rp-store-item">
              <div
                className="rp-store-thumb"
                style={{ background: STORE_THUMB_BG[store.icon] ?? 'var(--color-surface-alt)' }}
              >
                <Icon name={store.icon} />
              </div>
              <div className="rp-store-info">
                <div className="rp-store-name-row">
                  <span className="rp-store-name">{store.name}</span>
                  {store.tags.map((tag) => (
                    <span key={tag.type} className={`rp-tag rp-tag--${tag.type}`}>
                      {tag.label}
                    </span>
                  ))}
                </div>
                <div className="rp-store-meta">
                  <Icon name="pin" />
                  <span>
                    {store.distance} · {store.address}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`rp-store-like${likes[store.id] ? ' is-active' : ''}`}
                aria-label="찜하기"
                onClick={() => setLikes((prev) => ({ ...prev, [store.id]: !prev[store.id] }))}
              >
                <Icon name="heart" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="rp-owner-link-row">
        사장님이신가요? <Link to="/owner">사장님 페이지로 이동</Link>
      </p>

      <button className="rp-pull-indicator rp-pull-indicator--bottom" type="button" onClick={onShowHome}>
        <span className="rp-pull-hint">
          <Icon name="chevronUp" /> 첫 화면으로
        </span>
      </button>
    </div>
  );
}