import { useVisibleCategories } from '../../core/categories/useVisibleCategories';
import { useLayoutMode } from '../../core/device/LayoutModeContext';
import { useActivePath } from '../../core/router/useActivePath';
import CompactLandscapeNav from './compact-landscape/CompactLandscapeNav';
import CompactNav from './compact/CompactNav';
import DesktopNav from './desktop/DesktopNav';
import { useNavHandlers } from './handlers/useNavHandlers';

/**
 * 네비게이션 분기 지점.
 * 기기 모드에 따라 (1) 그릴 컴포넌트와 (2) 이벤트 핸들러 세트를 함께 고른다.
 * 카테고리 목록은 마스터 배열에서 가져오므로 개수가 바뀌어도 이 파일은 바뀌지 않는다.
 */
export default function Navigation() {
  const mode = useLayoutMode();
  const categories = useVisibleCategories();
  const handlers = useNavHandlers(mode);
  const activePath = useActivePath();

  const props = { ...categories, handlers, activePath };

  switch (mode) {
    case 'desktop':
      return <DesktopNav {...props} />;
    case 'compact-landscape':
      return <CompactLandscapeNav {...props} />;
    case 'compact':
    default:
      return <CompactNav {...props} />;
  }
}