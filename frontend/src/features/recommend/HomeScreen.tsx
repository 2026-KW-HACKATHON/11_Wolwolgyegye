import { useNavigate } from 'react-router-dom';
import { useVisibleCategories } from '../../core/categories/useVisibleCategories';
import Icon from '../../shared/Icon';
import { CATEGORY_VISUALS, NEIGHBORHOOD } from './recommendData';

export default function HomeScreen({ onShowNearby }: { onShowNearby: () => void }) {
  const { scrollable } = useVisibleCategories();
  const navigate = useNavigate();

  return (
    <div className="rp-home">
      <div className="rp-location">
        <Icon name="pin" /> {NEIGHBORHOOD}
      </div>

      <h1 className="rp-heading">
        오늘은 동네에서
        <br />뭐 할까요?
      </h1>

      <div className="rp-category-grid">
        {scrollable.map((cat) => {
          const visual = CATEGORY_VISUALS[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              className={`rp-category-card rp-cat-bg--${visual?.bg ?? 'space'}`}
              onClick={() => navigate(cat.path)}
            >
              <span className="rp-cat-icon">{visual && <Icon name={visual.icon} />}</span>
              <span className="rp-cat-bottom">
                <span className="rp-cat-label">{cat.name}</span>
                <span className="rp-cat-chevron">
                  <Icon name="chevronRight" />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button className="rp-cta" type="button" onClick={onShowNearby}>
        <Icon name="megaphone" />
        <span>가까운 가게의 혜택을 만나보세요</span>
        <Icon name="chevronRight" />
      </button>
    </div>
  );
}
