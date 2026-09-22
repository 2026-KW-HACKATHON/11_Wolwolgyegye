import { CATEGORIES } from '../../core/categories/categories';
import PlaceholderPage from '../../shared/PlaceholderPage';

const page = CATEGORIES.find((c) => c.id === 'roulette')!;

export default function RoulettePage() {
  return <PlaceholderPage page={page} />;
}
