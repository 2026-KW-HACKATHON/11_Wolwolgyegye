import type { Category } from '../../core/categories/categoryTypes';
import Icon from '../../shared/Icon';
import Sheet from '../../shared/sheet/Sheet';
import UserButton from '../UserButton/UserButton';
import './AllMenu.css';

interface AllMenuProps {
  open: boolean;
  /** 보여줄 전체 카테고리 (하단 바에 있는 것도 함께) */
  items: Category[];
  activeId: string;
  onSelect: (category: Category) => void;
  /** 유저 탭이 열려 있는지 */
  userActive: boolean;
  onSelectUser: () => void;
  onClose: () => void;
}

/**
 * 전체 메뉴 (세로 화면 전용). 하단 바에 다 들어가지 않는 카테고리와 유저 탭까지 모든 기능을 한 화면에 모아 보여준다.
 * 고르면 그 탭으로 가고 메뉴는 닫힌다.
 */
export default function AllMenu({ open, items, activeId, onSelect, userActive, onSelectUser, onClose }: AllMenuProps) {
  return (
    <Sheet open={open} title="전체 메뉴" onClose={onClose}>
      <ul className="all-menu">
        {items.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              className="all-menu__item"
              aria-current={category.id === activeId ? 'page' : undefined}
              onClick={() => onSelect(category)}
            >
              <Icon name={category.icon} className="all-menu__icon" />
              <span className="all-menu__label">{category.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="all-menu__user">
        <UserButton active={userActive} onClick={onSelectUser} />
      </div>
    </Sheet>
  );
}
