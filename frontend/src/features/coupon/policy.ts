import type { StampPolicy } from './types';

/** API 응답을 확인한다. 잘못된 기준을 10개로 대체하거나 0개 보상으로 처리하지 않는다. */
export function isStampPolicy(value: unknown): value is StampPolicy {
  const policy = value as Partial<StampPolicy> | null;
  return !!policy && typeof policy.storeId === 'string' && policy.storeId.trim().length > 0
    && Number.isSafeInteger(policy.requiredStamps) && (policy.requiredStamps ?? 0) > 0
    && typeof policy.reward === 'string' && policy.reward.trim().length > 0
    && typeof policy.unit === 'string' && typeof policy.condition === 'string';
}

export function validBalance(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
