import { CATEGORIES } from '../../core/categories/categories';
import PlaceholderPage from '../../shared/PlaceholderPage';

const page = CATEGORIES.find((c) => c.id === 'closing-sale')!;

export default function ClosingSalePage() {
  return <PlaceholderPage page={page} />;
}
