import { useCallback, useEffect, useState } from 'react';
import { fetchFeedPosts, FEED_CHANGE_EVENT, findFeedStore } from './feedSource';
import type { FeedKind, FeedPost } from './types';
import FeedPostDetail from './FeedPostDetail';
import './store-feed.css';

/**
 * 2차 탭 안의 "공간대여" / "원데이클래스" 묶음: 그 가게가 올린 글을 전부 상세로 이어서 보여준다.
 * 글이 없으면 아무것도 그리지 않는다. 글마다 data-sd-target="post-<id>" 를 달아 1차 탭에서 고른 글로 스크롤할 수 있다.
 */
export default function StoreFeedSection({ kind, storeId }: { kind: FeedKind; storeId: string }) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [now, setNow] = useState(Date.now);

  const load = useCallback(async () => {
    try {
      const list = await fetchFeedPosts(kind);
      setPosts(list.filter((post) => post.storeId === storeId));
    } catch {
      setPosts([]);
    }
    setNow(Date.now());
  }, [kind, storeId]);

  useEffect(() => {
    void load();
    const onChange = () => { void load(); };
    window.addEventListener(FEED_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(FEED_CHANGE_EVENT, onChange);
  }, [load]);

  if (!posts?.length) return null;
  return (
    <div className={`sf-page sf-page--${kind} sf-page--detail`}>
      {posts.map((post) => (
        <article key={post.id} className="sf-section-post" data-sd-target={`post-${post.id}`}>
          <FeedPostDetail post={post} store={findFeedStore(post.storeId)} now={now} />
        </article>
      ))}
    </div>
  );
}
