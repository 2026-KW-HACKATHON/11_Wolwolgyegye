import { ICONS, type IconName } from './icons';

interface IconProps {
  name: IconName;
  className?: string;
}

/** ICONS 의 SVG 마크업을 그려주는 얇은 래퍼. 값은 전부 고정 문자열이라 안전하다. */
export default function Icon({ name, className }: IconProps) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}