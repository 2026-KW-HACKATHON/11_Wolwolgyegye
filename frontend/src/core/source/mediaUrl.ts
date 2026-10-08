import { getSupabaseClient } from '../supabase/client';

/**
 * 게시글 사진은 사장님이 올린 Supabase Storage 경로와 발표용 정적 자산 경로를 함께 지원한다.
 */
export function resolveStoreMediaUrl(path: string): string {
  const value = path.trim();
  if (!value) return '';
  if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value;
  return getSupabaseClient().storage.from('store-media').getPublicUrl(value).data.publicUrl;
}
