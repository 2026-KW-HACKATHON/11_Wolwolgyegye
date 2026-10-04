import { useMemo } from 'react';
import { CATEGORIES } from './categories';
import { DEFAULT_ENABLED_IDS } from './enabledCategories';
import type { Category } from './categoryTypes';

/** 마스터 배열에서 "지금 보여줄 카테고리"를 순서대로 추려 준다. (고정 카테고리 + 사용자가 켠 카테고리) */
export function useVisibleCategories(): Category[] {
  return useMemo(() => CATEGORIES.filter((c) => c.isFixed || DEFAULT_ENABLED_IDS.includes(c.id)), []);
}
