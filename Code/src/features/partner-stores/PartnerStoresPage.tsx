import { CATEGORIES } from '../../core/categories/categories';
import PlaceholderPage from '../../shared/PlaceholderPage';

const page = CATEGORIES.find((c) => c.id === 'partner-stores')!;

export default function PartnerStoresPage() {
  return <PlaceholderPage page={page} />;
}