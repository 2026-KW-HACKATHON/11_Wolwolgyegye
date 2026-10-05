import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { DEFAULT_LANDING_PATH } from '../../core/categories/categories';
import Icon from '../../shared/Icon';
import Sheet from '../../shared/sheet/Sheet';
import { useToast } from '../../shared/toast/ToastContext';
import OwnerInfoPanel from './OwnerInfoPanel';
import OwnerSalePanel from './OwnerSalePanel';
import { OWNER_MENU, type OwnerMenuKey } from './ownerData';
import './owner.css';

/**
 * 사장님 앱. 손님 앱(AppShell) 밖의 독립 라우트(/owner). 가게를 가진 사용자만 들어온다 (router.tsx).
 * 글쓰기는 손님 앱의 글쓰기 창으로 보내고, 마감세일·가게 정보는 이 화면의 창(Sheet)에서 바로 고친다.
 * 가게가 여러 곳이면 위에서 고른 가게를 관리한다.
 */
export default function OwnerPage() {
  const showToast = useToast();
  const navigate = useNavigate();
  const { ownedStores, refresh } = useAuth();
  const [storeId, setStoreId] = useState(() => ownedStores[0]?.id ?? '');
  const [sheet, setSheet] = useState<'sale' | 'info' | null>(null);
  const store = ownedStores.find((s) => s.id === storeId) ?? ownedStores[0];

  function openMenu(key: OwnerMenuKey, label: string, pending?: boolean) {
    if (pending) { showToast(`${label}는 로그인 연동 뒤에 열려요`); return; }
    if (key === 'space') navigate('/space-rental?compose=1');
    else setSheet(key === 'coupon' ? null : key);
  }

  return (
    <div className="op-shell">
      <header className="op-header">
        <div className="op-brand">월계생활 사장님</div>
        {ownedStores.length > 1 ? (
          <select className="op-store-select" aria-label="관리할 가게" value={store?.id} onChange={(e) => setStoreId(e.target.value)}>
            {ownedStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : store && <span className="op-store-name">{store.name}</span>}
      </header>

      <div className="op-body">
        {!store ? <p className="op-muted">승인된 가게가 없어요.</p> : <>
          <button className="op-cta" type="button" onClick={() => navigate('/oneday-class?compose=1')}>
            <Icon name="building" />
            <span>클래스 등록</span>
            <Icon name="chevronRight" />
          </button>

          <div className="op-menu-grid">
            {OWNER_MENU.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`op-menu-item${item.wide ? ' is-wide' : ''}${item.pending ? ' is-pending' : ''}`}
                onClick={() => openMenu(item.key, item.label, item.pending)}
              >
                <span className="op-menu-icon">
                  <Icon name={item.icon} />
                </span>
                <span className="op-menu-text">
                  <span className="op-menu-label">{item.label}{item.pending && <small className="op-badge">준비 중</small>}</span>
                  <span className="op-menu-desc">{item.desc}</span>
                </span>
                <span className="op-menu-chevron">
                  <Icon name="chevronRight" />
                </span>
              </button>
            ))}
          </div>
        </>}
      </div>

      <p className="op-link-row">
        손님이신가요? <Link to={DEFAULT_LANDING_PATH}>손님 앱으로 이동</Link>
      </p>

      {store && <>
        <Sheet open={sheet === 'sale'} title={`마감세일 · ${store.name}`} onClose={() => setSheet(null)}>
          {sheet === 'sale' && <OwnerSalePanel storeId={store.id} />}
        </Sheet>
        <Sheet open={sheet === 'info'} title={`가게 정보 · ${store.name}`} onClose={() => setSheet(null)}>
          {sheet === 'info' && <OwnerInfoPanel storeId={store.id} onRenamed={() => void refresh()} />}
        </Sheet>
      </>}
    </div>
  );
}
