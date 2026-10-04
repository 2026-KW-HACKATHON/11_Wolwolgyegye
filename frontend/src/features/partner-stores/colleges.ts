import type { College } from './types';

/** 화면 필터에 사용하는 광운대학교 단과대 분류. 운영 혜택 데이터는 Supabase에서 조회한다. */
export const COLLEGES: College[] = [
  { key: 'eie', label: '전자정보', name: '전자정보공과대학' },
  { key: 'ai', label: 'AI융합', name: '인공지능융합대학' },
  { key: 'eng', label: '공과', name: '공과대학' },
  { key: 'sci', label: '자연과학', name: '자연과학대학' },
  { key: 'hss', label: '인문사회', name: '인문사회과학대학' },
  { key: 'law', label: '정책법학', name: '정책법학대학' },
  { key: 'biz', label: '경영', name: '경영대학' },
  { key: 'chambit', label: '참빛인재', name: '참빛인재대학' },
];
