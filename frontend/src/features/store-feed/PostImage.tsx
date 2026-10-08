import './PostImage.css';

interface PostImageProps {
  src: string;
  alt: string;
  onError?: () => void;
}

export const usesPortraitFrame = (src: string) => src.includes('/demo-posts/wolgye-bread-class.png');

/** 세로 사진은 흐린 배경 위에 원본 비율로 올려, 카드에서 잘리거나 눌려 보이지 않게 한다. */
export default function PostImage({ src, alt, onError }: PostImageProps) {
  const usePortraitFrame = usesPortraitFrame(src);
  if (!usePortraitFrame) return <img src={src} alt={alt} loading="lazy" onError={onError} />;

  return <span className="post-image-frame">
    <img className="post-image-frame__backdrop" src={src} alt="" aria-hidden="true" loading="lazy" />
    <img className="post-image-frame__photo" src={src} alt={alt} loading="lazy" onError={onError} />
  </span>;
}
