import { useRef } from 'react';
import HomeScreen from './HomeScreen';
import NearbyScreen from './NearbyScreen';
import './recommend.css';

/** 공통 AppShell 안에서 피드에서 지도로 자연스럽게 이어지는 모바일 우선 홈. */
export default function RecommendPage() {
  const mapSection = useRef<HTMLElement>(null);
  return <div className="rp-shell">
    <HomeScreen onShowNearby={() => mapSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
    <section ref={mapSection} className="rp-map-section" aria-label="우리 동네 지도"><NearbyScreen /></section>
  </div>;
}
