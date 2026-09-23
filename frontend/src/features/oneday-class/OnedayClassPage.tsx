import { CATEGORIES } from '../../core/categories/categories';
import PlaceholderPage from '../../shared/PlaceholderPage';

const page = CATEGORIES.find((c) => c.id === 'oneday-class')!;

export default function OnedayClassPage() {
  return <PlaceholderPage page={page} />;
}