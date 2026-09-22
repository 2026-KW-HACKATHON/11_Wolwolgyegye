import { Link } from 'react-router-dom';
import { DEFAULT_LANDING_PATH } from '../../core/categories/categories';
import Icon from '../../shared/Icon';
import { useToast } from '../../shared/toast/ToastContext';
import { OWNER_MENU } from './ownerData';
import './owner.css';

/**
 * 사장님 앱. develop 브랜치에서 손님 앱과 완전히 분리된 별도 화면이었던 것을 그대로 이식해
 * choo 브랜치의 AppShell/네비게이션 밖에 있는 독립 라우트(/owner)로 둔다.
 */
export default function OwnerPage() {
  const showToast = useToast();

  return (
    <div className="op-shell">
      <header className="op-header">
        <div className="op-brand">월계생활 사장님</div>
        <button
          type="button"
          className="op-icon-btn"
          aria-label="설정"
          onClick={() => showToast('설정 화면은 준비 중이에요')}
        >
          <Icon name="gear" />
        </button>
      </header>

      <div className="op-body">
        <div className="op-hero">
          <div className="op-hero-text">
            <h1 className="op-heading">
              새 소식을
              <br />
              알려보세요
            </h1>
            <span className="op-hero-tag">좋은 동네, 함께해요</span>
          </div>
          <div className="op-hero-art" aria-hidden="true">
            <Icon name="storefront" />
          </div>
        </div>

        <button
          className="op-cta"
          type="button"
          onClick={() => showToast('클래스 등록 화면은 준비 중이에요')}
        >
          <Icon name="building" />
          <span>클래스 등록</span>
          <Icon name="chevronRight" />
        </button>

        <div className="op-menu-grid">
          {OWNER_MENU.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`op-menu-item${item.wide ? ' is-wide' : ''}`}
              onClick={() => showToast(`${item.label} 화면은 준비 중이에요`)}
            >
              <span className="op-menu-icon">
                <Icon name={item.icon} />
              </span>
              <span className="op-menu-text">
                <span className="op-menu-label">{item.label}</span>
                <span className="op-menu-desc">{item.desc}</span>
              </span>
              <span className="op-menu-chevron">
                <Icon name="chevronRight" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="op-link-row">
        손님이신가요? <Link to={DEFAULT_LANDING_PATH}>손님 앱으로 이동</Link>
      </p>
    </div>
  );
}