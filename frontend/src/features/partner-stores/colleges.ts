import type { College } from './types';

/** 광운대학교 단과대학 목록 (실제 학교 구성. 예시 데이터가 아니다). DB 연결 후 partners 테이블 초기값으로 쓴다 */
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
