import { CATEGORIES } from '../../core/categories/categories';
import PlaceholderPage from '../../shared/PlaceholderPage';

const page = CATEGORIES.find((c) => c.id === 'space-rental')!;

export default function SpaceRentalPage() {
  return <PlaceholderPage page={page} />;
}