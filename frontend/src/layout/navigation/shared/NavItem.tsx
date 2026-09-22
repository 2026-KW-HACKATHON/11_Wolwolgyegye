import { useNavigate } from 'react-router-dom';
import type { PageMeta } from '../../../core/categories/categoryTypes';
import type { NavHandlers } from '../handlers/navHandlers';
import './NavItem.css';

interface NavItemProps {
  page: PageMeta;
  icon: string;
  active: boolean;
  handlers: NavHandlers;
  className?: string;
}

/** 네비게이션 항목 하나. 3종 네비게이션이 모두 이 컴포넌트를 재사용한다. */
export default function NavItem({ page, icon, active, handlers, className }: NavItemProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={`nav-item${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => handlers.onSelect(page, navigate)}
      onMouseEnter={handlers.onHoverStart ? () => handlers.onHoverStart?.(page) : undefined}
      onMouseLeave={handlers.onHoverEnd ? () => handlers.onHoverEnd?.(page) : undefined}
    >
      <span className="nav-item__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="nav-item__label">{page.name}</span>
    </button>
  );
}