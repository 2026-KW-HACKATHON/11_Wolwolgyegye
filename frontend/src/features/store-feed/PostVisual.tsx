import { useEffect, useState } from 'react';
import CategoryArt from './CategoryArt';
import PostImage, { usesPortraitFrame } from './PostImage';
import type { FeedPost } from './types';

/** 글의 대표 사진(DB 이미지 테이블의 첫 장). 없거나 못 불러오면 세부 분류별 기본 그림을 보여준다. */
export default function PostVisual({ post }: { post: FeedPost }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [post.imageUrl]);
  const portrait = usesPortraitFrame(post.imageUrl);
  return <div className={`sf-visual sf-visual--${post.kind}${portrait ? ' sf-visual--portrait' : ''}`}>
    {post.imageUrl && !failed ? <PostImage src={post.imageUrl} alt={post.title} onError={() => setFailed(true)} /> : <CategoryArt post={post} className="sf-art" />}
    <span className="sf-category-label">{post.category}</span>
  </div>;
}
