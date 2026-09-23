import { useEffect, useState } from 'react';
import Icon from '../../shared/Icon';
import type { FeedPost } from './types';

export default function PostVisual({ post }: { post: FeedPost }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [post.imageUrl]);
  return <div className={`sf-visual sf-visual--${post.kind}`}>
    {post.imageUrl && !failed ? <img src={post.imageUrl} alt={post.title} loading="lazy" onError={() => setFailed(true)} /> : <>
      <span className="sf-visual-orbit" aria-hidden="true" /><span className="sf-visual-icon" aria-hidden="true"><Icon name={post.kind === 'space-rental' ? 'house' : 'paletteColor'} /></span>
      <span className="sf-visual-caption">{post.kind === 'space-rental' ? 'A SPACE FOR US' : 'MAKE A LITTLE MEMORY'}</span>
    </>}
    <span className="sf-category-label">{post.category}</span>
  </div>;
}
