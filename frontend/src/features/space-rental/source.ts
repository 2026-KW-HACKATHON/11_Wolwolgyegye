import { fetchFeedPosts } from '../store-feed/feedSource';
import type { FeedPost } from '../store-feed/types';

/** 공간 대여 피드를 Supabase에서 조회한다. */
export async function fetchSpacePosts(): Promise<FeedPost[]> {
  return fetchFeedPosts('space-rental');
}
