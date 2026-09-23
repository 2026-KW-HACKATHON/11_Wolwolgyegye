import { useState } from 'react';
import Icon from '../../shared/Icon';
import HomeScreen from './HomeScreen';
import NearbyScreen from './NearbyScreen';
import './recommend.css';

type View = 'home' | 'nearby';

/**
 * develop 브랜치의 손님 앱 첫 화면 두 장(첫 화면 / 내 주변 가게)을 하나의 카테고리 페이지로 이식.
 * 위쪽 손잡이를 누르거나 CTA 버튼을 누르면 "내 주변 가게"로, 그 화면 아래쪽 손잡이를 누르면 다시 돌아온다.
 */
export default function RecommendPage() {
  const [view, setView] = useState<View>('home');

  return (
    <div className="rp-shell">
      <div className={`rp-screen-stack${view === 'nearby' ? ' is-nearby' : ''}`}>
        <div className="rp-screen rp-screen--home">
          <button
            type="button"
            className="rp-pull-indicator rp-pull-indicator--top"
            onClick={() => setView('nearby')}
            aria-label="내 주변 가게 보기"
          >
            <span className="rp-pull-handle" />
            <span className="rp-pull-hint">
              지도 · 가게 보기 <Icon name="chevronDown" />
            </span>
          </button>
          <div className="rp-scroll">
            <HomeScreen onShowNearby={() => setView('nearby')} />
          </div>
        </div>

        <div className="rp-screen rp-screen--nearby">
          <div className="rp-scroll">
            <NearbyScreen onShowHome={() => setView('home')} />
          </div>
        </div>
      </div>
    </div>
  );
}