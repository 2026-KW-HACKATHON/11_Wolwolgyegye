import { useMemo } from 'react';
import { CATEGORIES } from './categories';
import { DEFAULT_ENABLED_IDS } from './enabledCategories';
import type { Category } from './categoryTypes';

export interface VisibleCategories {
  /** 왼쪽 끝 고정 (예: 추천). 없으면 null */
  startFixed: Category | null;
  /** 오른쪽 끝 고정 (예: 로그인). 없으면 null */
  endFixed: Category | null;
  /** 스와이프 영역에 들어가는 선택형 카테고리 (개수 제한 없음) */
  scrollable: Category[];
}

/** 마스터 배열에서 "지금 보여줄 카테고리"를 추려 위치별로 나눠 준다. */
export function useVisibleCategories(): VisibleCategories {
  return useMemo(() => {
    const startFixed = CATEGORIES.find((c) => c.isFixed && c.fixedSide === 'left') ?? null;
    const endFixed = CATEGORIES.find((c) => c.isFixed && c.fixedSide === 'right') ?? null;
    const scrollable = CATEGORIES.filter(
      (c) => !c.isFixed && DEFAULT_ENABLED_IDS.includes(c.id),
    );
    return { startFixed, endFixed, scrollable };
  }, []);
}