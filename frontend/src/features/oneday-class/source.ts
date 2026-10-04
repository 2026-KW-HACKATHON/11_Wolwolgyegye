import { fetchFeedPosts } from '../store-feed/feedSource';
import type { FeedPost } from '../store-feed/types';

/** 원데이클래스 피드의 조회 경계. TODO(DB): oneday_classes 테이블 연결. 지금은 이 브라우저에서 만든 글만 돌려준다. */
export async function fetchClassPosts(): Promise<FeedPost[]> {
  return fetchFeedPosts('oneday-class');
}
