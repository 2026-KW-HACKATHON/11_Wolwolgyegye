import type { PageMeta } from '../core/categories/categoryTypes';
import './PlaceholderPage.css';

/**
 * 아직 실제 화면이 없는 카테고리용 공용 안내 페이지.
 * develop 브랜치에서도 이 화면들은 버튼을 누르면 "준비 중이에요" 토스트만 뜨는 정도로만 구현되어 있었다.
 */
export default function PlaceholderPage({ page }: { page: PageMeta }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page__badge">준비 중</div>
      <h2 className="placeholder-page__title">{page.name}</h2>
      <p className="placeholder-page__body">{page.help}</p>
    </div>
  );
}
