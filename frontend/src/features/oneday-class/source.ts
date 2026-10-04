import { fetchFeedPosts } from '../store-feed/feedSource';
import type { FeedPost } from '../store-feed/types';

/** 원데이클래스 피드를 Supabase에서 조회한다. */
export async function fetchClassPosts(): Promise<FeedPost[]> {
  return fetchFeedPosts('oneday-class');
}
