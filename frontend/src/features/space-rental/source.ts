import { fetchFeedPosts } from '../store-feed/feedSource';
import type { FeedPost } from '../store-feed/types';

/** 공간 대여 피드의 조회 경계. TODO(DB): space_rentals 테이블 연결. 지금은 이 브라우저에서 만든 글만 돌려준다. */
export async function fetchSpacePosts(): Promise<FeedPost[]> {
  return fetchFeedPosts('space-rental');
}
