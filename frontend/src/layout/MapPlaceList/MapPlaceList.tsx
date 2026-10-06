import { useMemo, useState } from 'react';
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
  /** 지금 지도에 보이는 가게 */
  items: MapListItem[];
  /** 그 외 카테고리를 골랐으면 그 이름 (제목에 붙인다) */
  filterLabel: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** 한 번에 그리는 최대 줄 수. 넘으면 검색으로 좁히게 안내한다 */
const MAX_ROWS = 150;

/**
 * 지도 대체 목록. 지도를 보기 어렵거나 키보드·화면 읽기 프로그램을 쓰는 사람도
 * 지금 지도에 표시된 가게를 글 목록으로 찾고 고를 수 있게 한다. 고르면 지도의 그 가게 정보(2차 탭)가 열린다.
 */
export default function MapPlaceList({ open, items, filterLabel, onPick, onClose }: MapPlaceListProps) {
  const [query, setQuery] = useState('');
  const matched = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return items
      .filter((item) => !term || `${item.name} ${item.category} ${item.address}`.toLocaleLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [items, query]);

  return (
    <Sheet open={open} title={filterLabel ? `${filterLabel} 가게 목록` : '지도의 가게 목록'} onClose={onClose}>
      <input
        type="search"
        className="mpl-search"
        aria-label="가게 이름·업종·주소 검색"
        placeholder="가게 이름·업종·주소 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="mpl-count" role="status">{matched.length}곳</p>
      {matched.length === 0 ? <p className="mpl-empty">조건에 맞는 가게가 없어요.</p> : (
        <ul className="mpl-list">
          {matched.slice(0, MAX_ROWS).map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onPick(item.id)}>
                <strong>{item.name}</strong>
                <span>{[item.category, item.address].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {matched.length > MAX_ROWS && <p className="mpl-empty">앞의 {MAX_ROWS}곳만 보여드려요. 검색어로 좁혀 보세요.</p>}
    </Sheet>
  );
}
