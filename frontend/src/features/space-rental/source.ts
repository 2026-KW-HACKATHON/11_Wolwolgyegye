import { fetchFeedPosts } from '../store-feed/feedSource';
import type { FeedPost } from '../store-feed/types';

/** 공간 대여 피드의 조회 경계. DB space_rentals 글 + 이 브라우저에서 만든 글. */
export async function fetchSpacePosts(): Promise<FeedPost[]> {
  return fetchFeedPosts('space-rental');
}
