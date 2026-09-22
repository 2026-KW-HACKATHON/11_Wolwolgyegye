import { CATEGORIES } from '../../core/categories/categories';
import PlaceholderPage from '../../shared/PlaceholderPage';

const page = CATEGORIES.find((c) => c.id === 'coupon')!;

export default function CouponPage() {
  return <PlaceholderPage page={page} />;
}
