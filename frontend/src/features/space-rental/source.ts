import { fetchStoresByIds } from '../../core/source/storeSource';
import type { Store } from '../../core/types/place';
import { MOCK_SPACES } from './mock';
import type { SpaceRentalSpace } from './types';
import { fetchFeedPosts } from '../store-feed/feedSource';
import type { FeedPost } from '../store-feed/types';

/** 화면이 받는 모양: 대여 가능한 공간 + 가게 공통 정보 */
export type SpaceRentalSpaceView = SpaceRentalSpace & { store: Store };

/**
 * 대여 가능한 공간 목록을 가져오는 지점. 화면은 이 함수만 바라본다.
 * Supabase 연동 시 rows 를 가져오는 줄만 아래처럼 바꾸면 된다.
 *
 *   const { data: rows } = await supabase.from('rental_spaces').select('*');
 */
export async function fetchSpaces(): Promise<SpaceRentalSpaceView[]> {
  const rows = MOCK_SPACES;
  const stores = await fetchStoresByIds(rows.map((r) => r.storeId));
  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    return store ? [{ ...row, store }] : [];
  });
}

/** 공간 대여 피드의 조회 경계. 현재는 mock과 이 브라우저에서 만든 글을 함께 돌려준다. */
export async function fetchSpacePosts(): Promise<FeedPost[]> {
  return fetchFeedPosts('space-rental');
}
