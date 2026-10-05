import type { CSSProperties, ReactElement } from 'react';
import type { FeedPost } from './types';

/**
 * 사진이 없는 공간대여·원데이클래스 글의 기본 그림. 세부 분류(FEED_CATEGORIES)마다 하나씩 있다.
 * 실제 매장 사진으로 보이지 않도록 단순한 일러스트로 그린다.
 * 색은 theme.css 팔레트 토큰을 style 의 var() 로 넣어서 팔레트·다크 모드를 따라간다.
 */
const fill = (token: string): CSSProperties => ({ fill: `var(--${token})` });
const line = (token: string, extra?: CSSProperties): CSSProperties => ({ stroke: `var(--${token})`, fill: 'none', ...extra });

type Tone = 'primary' | 'accent' | 'strong';
const TONES: Record<Tone, [string, string, string]> = {
  primary: ['primary-50', 'primary-200', 'primary-300'],
  accent: ['accent-100', 'accent-200', 'accent-300'],
  strong: ['strong-100', 'accent-200', 'strong-300'],
};

const SCENES: Record<string, { tone: Tone; draw: () => ReactElement }> = {
  '모임·파티': { tone: 'accent', draw: () => <>
    <path d="M30 34Q320 128 610 34" strokeWidth="3" style={line('accent-800')} />
    {[[80, 50], [150, 70], [220, 84], [290, 90], [360, 89], [430, 81], [500, 66], [565, 48]].map(([x, y], i) =>
      <path key={x} d={`M${x - 15} ${y}h30l-15 30Z`} style={fill(i % 2 ? 'primary-400' : 'strong-300')} />)}
    <path d="M150 196q-8-40 0-60M188 190q4-46-4-80M480 196q6-36-2-64" strokeWidth="2" style={line('accent-800')} />
    <ellipse cx="150" cy="118" rx="26" ry="32" style={fill('primary-400')} />
    <ellipse cx="186" cy="92" rx="26" ry="32" style={fill('strong-300')} />
    <ellipse cx="482" cy="112" rx="26" ry="32" style={fill('primary-300')} />
    <rect x="270" y="162" width="100" height="44" rx="6" style={fill('accent-50')} />
    <rect x="270" y="152" width="100" height="16" rx="6" style={fill('strong-300')} />
    <path d="M296 150v-22M320 150v-22M344 150v-22" strokeWidth="5" strokeLinecap="round" style={line('primary-500')} />
    <rect x="200" y="206" width="240" height="14" rx="7" style={fill('accent-800')} />
    <path d="M222 218l-10 50M418 218l10 50" strokeWidth="10" style={line('accent-800')} />
  </> },
  '스터디·회의': { tone: 'primary', draw: () => <>
    <rect x="98" y="27" width="166" height="160" rx="72" style={fill('accent-50')} />
    <path d="M181 28v159M100 110h163" strokeWidth="7" style={line('primary-300')} />
    <path d="M117 166l44-71 84 71Z" style={fill('primary-200')} />
    <path d="M345 95v80M345 95l-22 39h44Z" strokeWidth="6" strokeLinejoin="round" style={{ stroke: 'var(--primary-500)', fill: 'var(--accent-300)' }} />
    <path d="M390 173c-18-19-23-32-9-49 23 5 32 18 25 39M410 170c4-26 21-35 39-28-1 23-17 32-37 34" style={fill('primary-400')} />
    <path d="M390 172h41l-5 53h-30Z" style={fill('strong-400')} />
    <rect x="190" y="189" width="270" height="16" rx="8" style={fill('accent-800')} />
    <path d="M213 202l-11 64M435 202l12 64" strokeWidth="11" style={line('accent-800')} />
    <path d="M262 186l8-38h64l8 38Z" style={fill('accent-50')} /><path d="M276 154h52l-5 26h-42Z" style={fill('primary-300')} />
    <rect x="110" y="186" width="57" height="53" rx="17" style={fill('primary-400')} />
    <path d="M115 237v28M162 237v28" strokeWidth="7" style={line('primary-500')} />
    <rect x="491" y="186" width="57" height="53" rx="17" style={fill('primary-400')} />
    <path d="M496 237v28M543 237v28" strokeWidth="7" style={line('primary-500')} />
  </> },
  '촬영·작업': { tone: 'strong', draw: () => <>
    <rect x="370" y="44" width="190" height="196" style={fill('accent-50')} />
    <rect x="356" y="30" width="218" height="18" rx="9" style={fill('accent-800')} />
    <path d="M60 64l70 24v86l-70 24Z" style={fill('accent-50')} />
    <path d="M130 88v86" strokeWidth="6" style={line('accent-800')} />
    <path d="M95 190v76M70 266h50" strokeWidth="6" strokeLinecap="round" style={line('accent-800')} />
    <rect x="200" y="108" width="34" height="18" rx="5" style={fill('accent-800')} />
    <rect x="190" y="120" width="120" height="74" rx="14" style={fill('accent-800')} />
    <circle cx="250" cy="157" r="27" style={fill('primary-300')} />
    <circle cx="250" cy="157" r="13" style={fill('accent-50')} />
    <circle cx="290" cy="134" r="5" style={fill('strong-300')} />
    <path d="M250 194l-46 74M250 194l46 74M250 194v74" strokeWidth="6" strokeLinecap="round" style={line('accent-800')} />
    <path d="M420 200q30-50 60-20t50-30" strokeWidth="5" strokeLinecap="round" style={line('primary-400')} />
  </> },
  '연습·공연': { tone: 'primary', draw: () => <>
    <path d="M320 0L210 262h220Z" style={{ fill: 'var(--accent-50)', opacity: 0.75 }} />
    <rect x="292" y="0" width="56" height="20" rx="6" style={fill('accent-800')} />
    <path d="M320 140v118M290 262h60" strokeWidth="7" strokeLinecap="round" style={line('accent-800')} />
    <rect x="306" y="96" width="28" height="48" rx="14" style={fill('accent-800')} />
    <path d="M310 112h20M310 122h20" strokeWidth="3" style={line('primary-300')} />
    <rect x="460" y="146" width="80" height="112" rx="10" style={fill('accent-800')} />
    <circle cx="500" cy="180" r="15" style={fill('primary-300')} /><circle cx="500" cy="228" r="22" style={fill('primary-300')} />
    <path d="M140 140v-50l40-10v50" strokeWidth="5" style={line('primary-500')} />
    <circle cx="132" cy="142" r="10" style={fill('primary-500')} /><circle cx="172" cy="132" r="10" style={fill('primary-500')} />
    <path d="M420 92v-38l18 6" strokeWidth="5" style={line('strong-400')} /><circle cx="412" cy="94" r="9" style={fill('strong-400')} />
  </> },
  '공유주방': { tone: 'accent', draw: () => <>
    <path d="M390 54h160" strokeWidth="5" strokeLinecap="round" style={line('accent-800')} />
    <path d="M420 54v60M420 114q-14 0-14 14t14 14 14-14-14-14" strokeWidth="5" style={line('strong-400')} />
    <path d="M470 54v74M460 128h20v26h-20Z" strokeWidth="5" style={line('strong-400')} />
    <path d="M520 54v62M512 116h16l-3 30h-10Z" strokeWidth="5" style={line('strong-400')} />
    <path d="M250 86c-20-22 18-22 0-46M292 80c-20-22 18-22 0-46" strokeWidth="5" strokeLinecap="round" style={line('primary-400')} />
    <ellipse cx="270" cy="114" rx="70" ry="12" style={fill('accent-800')} />
    <path d="M200 116h140v56q0 20-20 20H220q-20 0-20-20Z" style={fill('strong-400')} />
    <path d="M200 130h-22M340 130h22" strokeWidth="9" strokeLinecap="round" style={line('accent-800')} />
    <rect x="110" y="192" width="420" height="18" rx="6" style={fill('accent-800')} />
    <rect x="130" y="210" width="380" height="58" style={fill('accent-50')} />
    <path d="M320 214v50M160 234h30M450 234h30" strokeWidth="5" strokeLinecap="round" style={line('accent-300')} />
  </> },
  '전시·팝업': { tone: 'strong', draw: () => <>
    <rect x="96" y="54" width="128" height="96" rx="4" strokeWidth="8" style={{ stroke: 'var(--accent-800)', fill: 'var(--accent-50)' }} />
    <path d="M106 140l38-44 30 30 18-16 24 30Z" style={fill('primary-300')} /><circle cx="190" cy="80" r="10" style={fill('strong-300')} />
    <rect x="262" y="36" width="96" height="128" rx="4" strokeWidth="8" style={{ stroke: 'var(--accent-800)', fill: 'var(--accent-50)' }} />
    <circle cx="310" cy="100" r="30" style={fill('primary-400')} />
    <rect x="398" y="66" width="140" height="92" rx="4" strokeWidth="8" style={{ stroke: 'var(--accent-800)', fill: 'var(--accent-50)' }} />
    <path d="M410 120q30-40 60 0t58 0" strokeWidth="8" strokeLinecap="round" style={line('strong-400')} />
    <rect x="232" y="212" width="176" height="16" rx="8" style={fill('accent-800')} />
    <path d="M252 226v40M388 226v40" strokeWidth="9" style={line('accent-800')} />
    <rect x="470" y="190" width="60" height="78" style={fill('accent-50')} /><rect x="462" y="182" width="76" height="12" style={fill('accent-800')} />
    <path d="M500 182l-12-34 30 4Z" style={fill('primary-400')} />
  </> },
  '요리·베이킹': { tone: 'strong', draw: () => <>
    <ellipse cx="312" cy="215" rx="150" ry="47" style={fill('accent-50')} />
    <ellipse cx="312" cy="215" rx="119" ry="30" style={fill('accent-300')} />
    <path d="M222 208q29-35 46 6t35-2 35 2 38-9 35 9M234 224q30-26 48-2t35-4 36 4 32-6" strokeWidth="8" strokeLinecap="round" style={line('accent-400')} />
    <path d="M300 181q-27-39-46-15 13 27 46 15M301 180q34-35 49-6-20 20-49 6" style={fill('primary-500')} />
    <rect x="130" y="158" width="10" height="97" rx="5" style={fill('strong-400')} />
    <path d="M124 125v38m10-38v38m10-38v38" strokeWidth="5" strokeLinecap="round" style={line('strong-400')} />
    <path d="M490 130v124h-10v-69q-21-10 10-55Z" style={fill('strong-400')} />
    <circle cx="410" cy="112" r="19" style={fill('strong-400')} /><path d="M403 99l8 6 7-8" strokeWidth="5" style={line('primary-500')} />
  </> },
  '커피·음료': { tone: 'accent', draw: () => <>
    <ellipse cx="330" cy="239" rx="159" ry="20" style={fill('strong-300')} />
    <path d="M245 149h126v61q0 30-63 30t-63-30Z" style={fill('accent-50')} />
    <path d="M372 165h23q26 20 0 43h-23" strokeWidth="16" style={line('accent-50')} />
    <ellipse cx="308" cy="149" rx="63" ry="15" style={fill('accent-800')} />
    <path d="M277 116c-25-29 23-29 0-60M318 106c-25-29 23-29 0-60" strokeWidth="5" strokeLinecap="round" style={line('primary-400')} />
    <path d="M151 133h50l13 99h-76Z" style={fill('accent-800')} />
    <path d="M469 106h64l-24 119h-20Z" style={fill('strong-300')} />
    <path d="M467 111h67" strokeWidth="7" style={line('accent-800')} />
  </> },
  '공예·미술': { tone: 'accent', draw: () => <>
    <ellipse cx="326" cy="248" rx="170" ry="19" style={fill('accent-300')} />
    <path d="M225 147h92v72q0 27-46 27t-46-27Z" style={fill('strong-400')} />
    <path d="M317 162h14q30 22 0 45h-14" strokeWidth="14" style={line('strong-400')} />
    <ellipse cx="271" cy="148" rx="46" ry="11" style={fill('accent-800')} />
    <path d="M390 132h40l-4 31q42 30 33 65t-50 12q-57 5-55-25t39-54Z" style={fill('primary-50')} />
    <path d="M409 132v-63m0 35q-46-4-36-26 28-2 36 26m0-17q37-7 35-31-28 0-35 31" strokeWidth="5" style={{ stroke: 'var(--primary-500)', fill: 'var(--primary-400)' }} />
    <path d="M148 181h38v60h-38Z" style={fill('primary-400')} />
    <path d="M158 181l-12-65m29 65 11-80m-18 80v-61" strokeWidth="6" style={line('accent-800')} />
  </> },
  '꽃·식물': { tone: 'primary', draw: () => <>
    <path d="M320 168v-90" strokeWidth="6" style={line('primary-500')} />
    <path d="M320 140q-50-6-56-44 44 0 56 44M320 120q44-10 52-48-42 2-52 48" style={fill('primary-400')} />
    {[0, 72, 144, 216, 288].map((deg) => <ellipse key={deg} cx="320" cy="56" rx="11" ry="22" transform={`rotate(${deg} 320 78)`} style={fill('strong-300')} />)}
    <circle cx="320" cy="78" r="12" style={fill('accent-300')} />
    <path d="M262 168h116l-14 84q-2 12-14 12h-60q-12 0-14-12Z" style={fill('strong-400')} />
    <rect x="254" y="160" width="132" height="18" rx="6" style={fill('accent-800')} />
    <path d="M140 210h80l-8 54h-64Z" style={fill('accent-50')} />
    <path d="M150 210q-10-50 10-70 14 30 10 70M180 210q4-60 30-74 6 40-12 74" style={fill('primary-300')} />
    <path d="M440 196h78v54q0 14-14 14h-50q-14 0-14-14Z" style={fill('primary-300')} />
    <path d="M518 210q36-6 44-36M440 214q-16 0-16-16" strokeWidth="8" strokeLinecap="round" style={line('primary-300')} />
  </> },
  '향·캔들': { tone: 'strong', draw: () => <>
    <path d="M300 98q-18-26 0-50 18 24 0 50" style={fill('strong-300')} />
    <path d="M300 92q-8-14 0-26 8 12 0 26" style={fill('accent-50')} />
    <path d="M300 98v18" strokeWidth="4" style={line('accent-800')} />
    <path d="M236 116h128v118q0 22-22 22h-84q-22 0-22-22Z" style={fill('accent-50')} />
    <rect x="236" y="150" width="128" height="44" style={fill('primary-300')} />
    <rect x="410" y="150" width="76" height="108" rx="16" style={fill('primary-400')} />
    <rect x="432" y="122" width="32" height="30" rx="4" style={fill('accent-800')} />
    <rect x="426" y="104" width="44" height="20" rx="8" style={fill('strong-300')} />
    <path d="M150 260q10-80 40-120M170 210q-30-10-36-34 30 2 36 34M180 176q24-14 22-40-24 10-22 40" strokeWidth="5" style={{ stroke: 'var(--primary-500)', fill: 'var(--primary-400)' }} />
    <path d="M500 96q16-14 4-30M520 104q16-14 4-30" strokeWidth="4" strokeLinecap="round" style={line('primary-400')} />
  </> },
  '운동·건강': { tone: 'primary', draw: () => <>
    <rect x="120" y="226" width="300" height="22" rx="11" style={fill('primary-400')} />
    <circle cx="430" cy="214" r="34" style={fill('primary-400')} /><circle cx="430" cy="214" r="18" style={fill('primary-300')} />
    <rect x="200" y="160" width="140" height="14" rx="7" style={fill('accent-800')} />
    <rect x="182" y="132" width="26" height="70" rx="8" style={fill('strong-400')} /><rect x="332" y="132" width="26" height="70" rx="8" style={fill('strong-400')} />
    <rect x="160" y="146" width="22" height="42" rx="7" style={fill('strong-300')} /><rect x="358" y="146" width="22" height="42" rx="7" style={fill('strong-300')} />
    <rect x="496" y="120" width="44" height="128" rx="14" style={fill('accent-50')} />
    <rect x="504" y="100" width="28" height="24" rx="6" style={fill('accent-800')} />
    <rect x="496" y="164" width="44" height="40" style={fill('primary-300')} />
    <path d="M100 100q20-30 40 0t40 0" strokeWidth="6" strokeLinecap="round" style={line('primary-500')} />
  </> },
};

export default function CategoryArt({ post, className }: { post: Pick<FeedPost, 'kind' | 'category'>; className?: string }) {
  const scene = SCENES[post.category] ?? SCENES[post.kind === 'space-rental' ? '스터디·회의' : '공예·미술'];
  const [bg, sun, ground] = TONES[scene.tone];
  return <svg className={className} viewBox="0 0 640 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="640" height="300" style={fill(bg)} />
    <circle cx="560" cy="50" r="96" style={fill(sun)} />
    <path d="M0 258Q165 222 350 262T640 250V300H0Z" style={fill(ground)} />
    {scene.draw()}
    <path d="M52 44h19m-9-9v19M590 200h17m-8-9v18" strokeWidth="3" strokeLinecap="round" style={line('primary-400')} />
  </svg>;
}
