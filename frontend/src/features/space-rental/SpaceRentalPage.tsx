import StoreFeedPage from '../store-feed/StoreFeedPage';
import { fetchSpacePosts } from './source';

export default function SpaceRentalPage() {
  return <StoreFeedPage kind="space-rental" loadPosts={fetchSpacePosts} />;
}
