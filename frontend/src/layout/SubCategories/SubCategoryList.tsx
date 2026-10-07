import { MAP_FILTERS, type MapFilter } from '../../core/categories/subCategories';
import './SubCategoryList.css';

interface SubCategoryListProps {
  items: MapFilter[];
  selectedId: string | null;
  /** 업종별 가게 수 (고른 항목에 붙인다) */
  counts: Record<string, number>;
  onToggle: (id: string) => void;
}

/**
 * 그 외 카테고리 항목 — 지도 위쪽의 얇은 한 줄 목록. 아이콘이 정해지기 전까지 번호 + 글자로 표시한다.
 * 번호는 전체 목록 기준이라, 일부 항목이 빠져도 같은 항목은 같은 번호다.
 * 묶음(음식점·카페·편의점·그 외) 사이에 구분선을 넣고, 고른 항목에만 가게 수를 붙인다. 다시 누르면 선택이 풀린다.
 */
export default function SubCategoryList({ items, selectedId, counts, onToggle }: SubCategoryListProps) {
  return (
    <ul className="sub-cats">
      {items.map((item, index) => {
        const isSelected = item.id === selectedId;
        const newGroup = index > 0 && items[index - 1].group !== item.group;
        return (
          <li key={item.id} className={newGroup ? 'sub-cats__group-start' : undefined}>
            <button type="button" className="sub-cats__item" aria-pressed={isSelected} onClick={() => onToggle(item.id)}>
              <span className="sub-cats__num">{MAP_FILTERS.indexOf(item) + 1}</span>
              <span className="sub-cats__label">{item.label}</span>
              {isSelected && <span className="sub-cats__count">{counts[item.id] ?? 0}곳</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
