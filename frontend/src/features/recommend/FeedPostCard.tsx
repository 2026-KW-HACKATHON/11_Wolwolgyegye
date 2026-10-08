import { Link } from 'react-router-dom';
import Icon from '../../shared/Icon';
import { useFavoriteStores } from '../../shared/favorites/useFavoriteStores';
import { useToast } from '../../shared/toast/ToastContext';
import { findFeedStore } from '../store-feed/feedSource';
import { formatPrice, isAvailable, type FeedPost } from '../store-feed/types';
import CategoryArt from '../store-feed/CategoryArt';
import PostImage, { usesPortraitFrame } from '../store-feed/PostImage';

export default function FeedPostCard({ post, onShowStore }: { post: FeedPost; onShowStore: (id: string) => void }) {
  const store = findFeedStore(post.storeId);
  const { isFavorite, toggle } = useFavoriteStores();
  const toast = useToast();
  const saved = isFavorite(post.storeId);
  const href = (post.kind === 'space-rental' ? '/space-rental' : '/oneday-class') + '?post=' + encodeURIComponent(post.id);
  const available = isAvailable(post);
  const schedule = post.kind === 'space-rental' ? '최대 ' + post.capacity + '명' + (post.minimumHours ? ' · ' + post.minimumHours + '시간부터' : '') :
    new Date(post.startsAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) + ' · ' + post.durationMinutes + '분';

  return <article className="rp-post">
    <header className="rp-post-owner">
      <span className="rp-post-avatar" aria-hidden="true"><Icon name="storefront" /></span>
      <div><strong>{store?.name ?? '동네 가게'}</strong><span className="rp-local-badge">월계1동 가게</span>{store?.isMock && <span>예시</span>}</div>
      <button type="button" className={'rp-save' + (saved ? ' is-saved' : '')} aria-pressed={saved} aria-label={(store?.name ?? '가게') + (saved ? ' 찜 해제' : ' 찜하기')} title={saved ? '찜 해제' : '찜하기'} onClick={async () => {
        const added = await toggle(post.storeId);
        if (added !== null) toast(added ? '찜한 가게에 담았어요.' : '찜한 가게에서 해제했어요.');
      }}><Icon name="heart" /></button>
    </header>
    <Link className="rp-post-main" to={href}>
      <h3>{post.title}</h3>
      <div className={'rp-post-cover rp-post-cover--' + post.kind + (usesPortraitFrame(post.imageUrl) ? ' rp-post-cover--portrait' : '')}>
        {post.imageUrl ? <PostImage src={post.imageUrl} alt={post.title} /> : <CategoryArt post={post} className="rp-artwork" />}
        <span className="rp-post-type">{post.kind === 'space-rental' ? '공간 대여' : '원데이클래스'}</span>
      </div>
      <div className="rp-post-body">
        <div className="rp-post-category"><span>{post.category}</span><span className={available ? 'rp-available' : ''}>{available ? (post.kind === 'space-rental' ? '이용 문의 가능' : '모집 중') : '모집 마감'}</span></div>
        <p className="rp-post-description">{post.summary || post.description}</p>
        <p className="rp-post-schedule"><Icon name={post.kind === 'space-rental' ? 'house' : 'calendar'} />{schedule}</p>
        <div className="rp-post-price"><strong>{formatPrice(post)}</strong><span>자세히 보기 <Icon name="chevronRight" /></span></div>
      </div>
    </Link>
    {store && <button className="rp-post-location" type="button" onClick={() => onShowStore(store.id)} aria-label={store.name + ' 지도에서 보기'}>
      <Icon name="pin" /><span>{store.address.replace(/^서울(특별)?시?\s*노원구\s*/, '')}</span><strong>지도에서 보기</strong><Icon name="chevronRight" />
    </button>}
  </article>;
}
