import type { Category, PageMeta } from './categoryTypes';

/**
 * 카테고리 마스터 목록.
 * 네비게이션은 이 배열을 순회해서 그리므로, 항목이 늘거나 줄어도 레이아웃 코드는 바꾸지 않는다.
 * 규칙: 기존 필드는 바꾸지 않고 필요한 필드는 추가만 한다.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'recommend',
    name: '홈버튼',
    path: '/recommend',
    icon: '★',
    isFixed: true,
    fixedSide: 'left',
    help: '우리 동네에서 지금 볼 만한 가게와 소식을 모아 보여주는 화면입니다. (임시 안내 문구)',
  },
  {
    id: 'space-rental',
    name: '공간 대여',
    path: '/space-rental',
    icon: '▣',
    isFixed: false,
    help: '동네의 빌릴 수 있는 공간을 찾고 예약하는 화면입니다. (임시 안내 문구)',
  },
  {
    id: 'oneday-class',
    name: '원데이클래스',
    path: '/oneday-class',
    icon: '✎',
    isFixed: false,
    help: '하루짜리 체험 수업을 찾고 신청하는 화면입니다. (임시 안내 문구)',
  },
  {
    id: 'roulette',
    name: '룰렛',
    path: '/roulette',
    icon: '◎',
    isFixed: false,
    help: '룰렛을 돌려 오늘 먹을 메뉴를 정하고, 그 메뉴를 파는 가까운 가게를 추천받는 화면입니다.',
  },
  {
    id: 'closing-sale',
    name: '마감세일',
    path: '/closing-sale',
    icon: '%',
    isFixed: false,
    help: '동네 가게가 영업 마감 전에 올린 할인을 마감 임박순으로 보여주는 화면입니다. 세일 등록은 사장님 전용 화면에서 합니다.',
  },
  {
    id: 'coupon',
    name: '스탬프',
    path: '/coupon',
    icon: '◈',
    isFixed: false,
    help: '가게를 골라 나의 스탬프 적립 현황을 확인해요. 가게별로 정해진 횟수를 채우면 상품을 받을 수 있어요.',
  },
  {
    id: 'partner-stores',
    name: '제휴 가게',
    path: '/partner-stores',
    icon: '❖',
    isFixed: false,
    help: '소속 단과대학을 고르면 광운대 학생 제휴 혜택이 있는 가게를 볼 수 있어요. 제휴 내용은 각 단과대 학생회 공지를 기준으로 해요.',
  },
  {
    id: 'login',
    name: '로그인',
    path: '/login',
    icon: '●',
    isFixed: true,
    fixedSide: 'right',
    help: '로그인하거나 계정 유형을 확인하는 화면입니다. (임시 안내 문구)',
  },
];

/**
 * 카테고리가 아닌 화면. 네비게이션 배열에는 넣지 않고 전용 버튼(톱니바퀴 등)으로만 진입한다.
 */
export const SETTINGS_PAGE: PageMeta = {
  id: 'settings',
  name: '설정',
  path: '/settings',
  help: '앱 설정과 보여줄 카테고리를 고르는 화면입니다. (임시 안내 문구)',
};

/** 경로 매칭에 쓰는 전체 화면 목록 */
export const ALL_PAGES: PageMeta[] = [...CATEGORIES, SETTINGS_PAGE];

export const DEFAULT_LANDING_PATH = '/recommend';