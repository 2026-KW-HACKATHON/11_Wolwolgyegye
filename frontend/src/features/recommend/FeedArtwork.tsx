import type { FeedPost } from '../store-feed/types';

/** 사진이 없는 게시글의 분류를 설명하는 일러스트. 실제 매장 사진으로 표시하지 않는다.
 * 색은 theme.css 팔레트 토큰 (Canvas 가 아니라 style 의 var() 로 넣는다). */
export default function FeedArtwork({ post }: { post: Pick<FeedPost, 'kind' | 'category'> }) {
  const space = post.kind === 'space-rental';
  const coffee = post.category === '커피·음료';
  const cooking = post.category === '요리·베이킹';
  return <svg className="rp-artwork" viewBox="0 0 640 300" aria-hidden="true">
    <rect width="640" height="300" style={{ fill: space ? 'var(--primary-50)' : coffee ? 'var(--accent-100)' : 'var(--strong-100)' }} />
    <circle cx="542" cy="57" r="99" style={{ fill: space ? 'var(--primary-200)' : 'var(--accent-200)' }} />
    <path d="M0 252Q165 213 350 256T640 245V300H0Z" style={{ fill: space ? 'var(--primary-300)' : 'var(--accent-300)' }} />
    {space ? <>
      <rect x="98" y="27" width="166" height="160" rx="72" style={{ fill: 'var(--accent-50)' }} />
      <path d="M181 28v159M100 110h163" strokeWidth="7" style={{ stroke: 'var(--primary-300)' }} />
      <path d="M117 166l44-71 84 71Z" style={{ fill: 'var(--primary-200)' }} />
      <path d="M345 95v80M345 95l-22 39h44Z" strokeWidth="6" strokeLinejoin="round" style={{ stroke: 'var(--primary-500)', fill: 'var(--accent-300)' }} />
      <path d="M390 173c-18-19-23-32-9-49 23 5 32 18 25 39M410 170c4-26 21-35 39-28-1 23-17 32-37 34" style={{ fill: 'var(--primary-400)' }} />
      <path d="M390 172h41l-5 53h-30Z" style={{ fill: 'var(--strong-400)' }} />
      <rect x="190" y="189" width="270" height="16" rx="8" style={{ fill: 'var(--accent-800)' }} />
      <path d="M213 202l-11 64M435 202l12 64" strokeWidth="11" style={{ stroke: 'var(--accent-800)' }} />
      <rect x="275" y="170" width="40" height="17" rx="4" style={{ fill: 'var(--strong-300)' }} />
      <path d="M290 168v-20l9-9" strokeWidth="5" fill="none" style={{ stroke: 'var(--primary-500)' }} />
      <rect x="110" y="186" width="57" height="53" rx="17" style={{ fill: 'var(--primary-400)' }} />
      <path d="M115 237v28M162 237v28" strokeWidth="7" style={{ stroke: 'var(--primary-500)' }} />
      <rect x="491" y="186" width="57" height="53" rx="17" style={{ fill: 'var(--primary-400)' }} />
      <path d="M496 237v28M543 237v28" strokeWidth="7" style={{ stroke: 'var(--primary-500)' }} />
    </> : coffee ? <>
      <ellipse cx="330" cy="239" rx="159" ry="20" style={{ fill: 'var(--strong-300)' }} />
      <path d="M245 149h126v61q0 30-63 30t-63-30Z" style={{ fill: 'var(--accent-50)' }} />
      <path d="M372 165h23q26 20 0 43h-23" fill="none" strokeWidth="16" style={{ stroke: 'var(--accent-50)' }} />
      <ellipse cx="308" cy="149" rx="63" ry="15" style={{ fill: 'var(--accent-800)' }} />
      <path d="M277 116c-25-29 23-29 0-60M318 106c-25-29 23-29 0-60" strokeWidth="5" fill="none" strokeLinecap="round" style={{ stroke: 'var(--primary-400)' }} />
      <path d="M151 133h50l13 99h-76Z" style={{ fill: 'var(--accent-800)' }} />
      <path d="M469 106h64l-24 119h-20Z" style={{ fill: 'var(--strong-300)' }} />
      <path d="M467 111h67" strokeWidth="7" style={{ stroke: 'var(--accent-800)' }} />
    </> : cooking ? <>
      <ellipse cx="312" cy="215" rx="150" ry="47" style={{ fill: 'var(--accent-50)' }} />
      <ellipse cx="312" cy="215" rx="119" ry="30" style={{ fill: 'var(--accent-300)' }} />
      <path d="M222 208q29-35 46 6t35-2 35 2 38-9 35 9M234 224q30-26 48-2t35-4 36 4 32-6" strokeWidth="8" fill="none" strokeLinecap="round" style={{ stroke: 'var(--accent-400)' }} />
      <path d="M300 181q-27-39-46-15 13 27 46 15M301 180q34-35 49-6-20 20-49 6" style={{ fill: 'var(--primary-500)' }} />
      <rect x="130" y="158" width="10" height="97" rx="5" style={{ fill: 'var(--strong-400)' }} />
      <path d="M124 125v38m10-38v38m10-38v38" strokeWidth="5" strokeLinecap="round" style={{ stroke: 'var(--strong-400)' }} />
      <path d="M490 130v124h-10v-69q-21-10 10-55Z" style={{ fill: 'var(--strong-400)' }} />
      <circle cx="410" cy="112" r="19" style={{ fill: 'var(--strong-400)' }} /><path d="M403 99l8 6 7-8" strokeWidth="5" fill="none" style={{ stroke: 'var(--primary-500)' }} />
    </> : <>
      <ellipse cx="326" cy="248" rx="170" ry="19" style={{ fill: 'var(--accent-300)' }} />
      <path d="M225 147h92v72q0 27-46 27t-46-27Z" style={{ fill: 'var(--strong-400)' }} />
      <path d="M317 162h14q30 22 0 45h-14" strokeWidth="14" fill="none" style={{ stroke: 'var(--strong-400)' }} />
      <ellipse cx="271" cy="148" rx="46" ry="11" style={{ fill: 'var(--accent-800)' }} />
      <path d="M390 132h40l-4 31q42 30 33 65t-50 12q-57 5-55-25t39-54Z" style={{ fill: 'var(--primary-50)' }} />
      <path d="M409 132v-63m0 35q-46-4-36-26 28-2 36 26m0-17q37-7 35-31-28 0-35 31" strokeWidth="5" style={{ stroke: 'var(--primary-500)', fill: 'var(--primary-400)' }} />
      <path d="M148 181h38v60h-38Z" style={{ fill: 'var(--primary-400)' }} />
      <path d="M158 181l-12-65m29 65 11-80m-18 80v-61" strokeWidth="6" style={{ stroke: 'var(--accent-800)' }} />
    </>}
    <path d="M63 59h19m-9-9v19M565 194h17m-8-9v18" strokeWidth="3" strokeLinecap="round" style={{ stroke: 'var(--primary-400)' }} />
  </svg>;
}
