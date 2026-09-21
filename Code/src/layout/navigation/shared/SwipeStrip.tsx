import { useEffect, useRef } from 'react';
import type { Category } from '../../../core/categories/categoryTypes';
import type { NavHandlers } from '../handlers/navHandlers';
import NavItem from './NavItem';
import './SwipeStrip.css';

interface SwipeStripProps {
  items: Category[];
  activePath: string;
  handlers: NavHandlers;
}

/**
 * 좌우로 밀어서 움직이는 카테고리 영역 (브라우저 기본 가로 스크롤 사용).
 * 항목 개수에 관계없이 동작한다: 적으면 가운데 정렬, 많으면 스와이프.
 */
export default function SwipeStrip({ items, activePath, handlers }: SwipeStripProps) {
  const ref = useRef<HTMLDivElement>(null);

  // 선택된 항목이 화면 밖에 있으면 보이는 위치로 옮긴다
  useEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activePath]);

  return (
    <div className="swipe-strip" ref={ref}>
      {items.map((c) => (
        <NavItem
          key={c.id}
          page={c}
          icon={c.icon}
          active={c.path === activePath}
          handlers={handlers}
          className="swipe-strip__item"
        />
      ))}
    </div>
  );
}