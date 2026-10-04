import { fetchFeedPosts } from '../store-feed/feedSource';
import type { FeedPost } from '../store-feed/types';

/** 원데이클래스 피드의 조회 경계. DB one_day_classes 글 + 이 브라우저에서 만든 글. */
export async function fetchClassPosts(): Promise<FeedPost[]> {
  return fetchFeedPosts('oneday-class');
}
