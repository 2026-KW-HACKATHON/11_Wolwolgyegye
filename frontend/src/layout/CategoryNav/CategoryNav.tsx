import { useEffect, useRef, type ReactNode, type WheelEvent } from 'react';
import type { Category } from '../../core/categories/categoryTypes';
import Icon from '../../shared/Icon';
import './CategoryNav.css';

interface CategoryNavProps {
  /** horizontal: 세로 화면 하단 바 / vertical: 가로 화면 우측 바 */
  orientation: 'horizontal' | 'vertical';
  /** true 면 항목을 밀어서(스와이프) 넘기고, false 면 전부 고정으로 나열한다 (PC·태블릿 가로) */
  scrollable: boolean;
  items: Category[];
  activeId: string;
  onSelect: (category: Category) => void;
  /** 유저(로그인·설정) 버튼 */
  userButton?: ReactNode;
  /**
   * list: 카테고리 목록 맨 끝에 붙어 함께 스와이프된다 (모바일·태블릿 세로, 모바일 가로)
   * end : 바 맨 아래에 따로 고정된다 (PC·태블릿 가로)
   */
  userPlacement?: 'list' | 'end';
}

/**
 * 카테고리 네비게이션 바. 마스터 배열을 그대로 순회하므로 항목 수가 바뀌어도 이 파일은 바뀌지 않는다.
 * 같은 카테고리를 다시 누르면 그 카테고리의 1차 탭이 접히거나 펼쳐진다. (AppShell 에서 처리)
 */
export default function CategoryNav({ orientation, scrollable, items, activeId, onSelect, userButton, userPlacement = 'list' }: CategoryNavProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // 선택된 항목이 화면 밖에 있으면 보이는 위치로 옮긴다
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  // 마우스 휠로도 가로 바를 넘길 수 있게 한다
  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (orientation !== 'horizontal' || !listRef.current || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    listRef.current.scrollLeft += event.deltaY;
  }

  return (
    <nav className="cat-nav" data-orientation={orientation} data-scrollable={scrollable} aria-label="카테고리">
      <div className="cat-nav__list" ref={listRef} onWheel={onWheel}>
        {items.map((category) => (
          <button
            key={category.id}
            type="button"
            className="cat-nav__item"
            aria-current={category.id === activeId ? 'page' : undefined}
            onClick={() => onSelect(category)}
          >
            <Icon name={category.icon} className="cat-nav__icon" />
            <span className="cat-nav__label">{category.name}</span>
          </button>
        ))}
        {userButton && userPlacement === 'list' && <div className="cat-nav__user">{userButton}</div>}
      </div>
      {userButton && userPlacement === 'end' && <div className="cat-nav__end">{userButton}</div>}
    </nav>
  );
}
