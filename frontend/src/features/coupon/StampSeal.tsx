import { useId, type CSSProperties } from 'react';

/**
 * 적립판에 찍히는 도장 한 개. 잉크 번짐·거친 테두리는 SVG 필터로 만든다. (그림일 뿐이라 aria-hidden)
 * 색은 currentColor 라서 CSS(.st-seal)에서 정한다.
 */
export default function StampSeal({ initial, date, tilt, seed }: {
  initial: string;
  date?: string;
  tilt: number;
  seed: number;
}) {
  const id = `st-ink-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className="st-seal"
      viewBox="0 0 100 100"
      style={{ '--st-tilt': `${tilt}deg` } as CSSProperties}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={id} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed={seed} result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed={seed + 7} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.4 0 0 0 2.75" result="holes" />
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${id})`} fill="currentColor" stroke="currentColor">
        <circle cx="50" cy="50" r="44" fill="none" strokeWidth="5.5" />
        <circle cx="50" cy="50" r="36" stroke="none" opacity="0.07" />
        <circle cx="50" cy="50" r="36" fill="none" strokeWidth="2" />
        <path d="M50 20.5l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" stroke="none" />
        <text x="50" y={date ? 60 : 64} textAnchor="middle" fontSize={date ? 28 : 34} fontWeight="900" stroke="none">{initial}</text>
        {date && <text x="50" y="78.5" textAnchor="middle" fontSize="12" fontWeight="800" stroke="none">{date}</text>}
      </g>
    </svg>
  );
}
