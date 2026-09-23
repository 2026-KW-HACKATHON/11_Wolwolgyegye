import StoreFeedPage from '../store-feed/StoreFeedPage';
import { fetchClassPosts } from './source';

export default function OnedayClassPage() {
  return <StoreFeedPage kind="oneday-class" loadPosts={fetchClassPosts} />;
}
