import { useMemo } from 'react';
import type { MapFilter } from '../../core/categories/subCategories';
import Sheet from '../../shared/sheet/Sheet';
import './MapPlaceList.css';

/** 목록 한 줄 (카테고리 가게·지도 가게 모두 이 모양으로 바꿔서 넘긴다) */
export interface MapListItem {
  id: string;
  name: string;
  category: string;
  address: string;
}

interface MapPlaceListProps {
  open: boolean;
  /** 지금 지도에 보이는 가게 (지도 위 검색어·업종 선택이 이미 적용된 목록) */
  items: MapListItem[];
  /** 업종 버튼 (지도 위 업종 줄과 같은 항목) */
  filters: MapFilter[];
  /** 고른 업종 id. 없으면 전체 */
  selectedId: string | null;
  /** 업종별 가게 수 */
  counts: Record<string, number>;
  /** 업종 버튼을 누르면 지도 위 업종 선택도 같이 바뀐다. null 이면 전체 */
  onSelectFilter: (id: string | null) => void;
  /** 지도 위 검색창에 입력한 검색어 (없으면 '') */
  searchTerm: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** 한 번에 그리는 최대 줄 수. 넘으면 업종·검색으로 좁히게 안내한다 */
const MAX_ROWS = 150;

/**
 * 지도 대체 목록. 지도를 보기 어렵거나 키보드·화면 읽기 프로그램을 쓰는 사람도
 * 지금 지도에 표시된 가게를 글 목록으로 찾고 고를 수 있게 한다. 고르면 지도의 그 가게 정보(2차 탭)가 열린다.
 * 검색은 지도 위 검색창이 맡고, 여기서는 업종 버튼(한식·중식 …)으로 고른다. 업종 선택은 지도와 함께 쓴다.
 */
export default function MapPlaceList({ open, items, filters, selectedId, counts, onSelectFilter, searchTerm, onPick, onClose }: MapPlaceListProps) {
  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [items]);
  const selected = filters.find((f) => f.id === selectedId) ?? null;

  return (
    <Sheet open={open} title={selected ? `${selected.label} 가게 목록` : '지도의 가게 목록'} onClose={onClose}>
      <div className="mpl-filters" role="group" aria-label="업종">
        <button type="button" className="mpl-filter" aria-pressed={!selectedId} onClick={() => onSelectFilter(null)}>전체</button>
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className="mpl-filter"
            aria-pressed={filter.id === selectedId}
            onClick={() => onSelectFilter(filter.id === selectedId ? null : filter.id)}
          >
            {filter.label}
            <span className="mpl-filter__count">{counts[filter.id] ?? 0}</span>
          </button>
        ))}
      </div>
      <p className="mpl-count" role="status">
        {sorted.length}곳{searchTerm && <> · ‘{searchTerm}’ 검색 결과</>}
      </p>
      {sorted.length === 0 ? <p className="mpl-empty">조건에 맞는 가게가 없어요.</p> : (
        <ul className="mpl-list">
          {sorted.slice(0, MAX_ROWS).map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onPick(item.id)}>
                <strong>{item.name}</strong>
                <span>{[item.category, item.address].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > MAX_ROWS && <p className="mpl-empty">앞의 {MAX_ROWS}곳만 보여드려요. 업종 버튼이나 지도 위 검색창으로 좁혀 보세요.</p>}
    </Sheet>
  );
}
