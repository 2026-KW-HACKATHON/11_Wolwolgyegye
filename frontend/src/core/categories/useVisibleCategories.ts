import { useMemo } from 'react';
import { useAuthStatus } from '../auth/useAuthStatus';
import { CATEGORIES } from './categories';
import type { Category } from './categoryTypes';

/** 마스터 배열에서 "지금 보여줄 카테고리"를 순서대로 추려 준다. (사장님 전용은 사장님에게만) */
export function useVisibleCategories(): Category[] {
  const isOwner = useAuthStatus() === 'owner';
  return useMemo(() => CATEGORIES.filter((c) => !c.ownerOnly || isOwner), [isOwner]);
}
