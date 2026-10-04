import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from './config';

let client: SupabaseClient | undefined;

/** 실제 DB 기능을 사용할 때만 초기화한다. 설정이 없는 예시 화면은 그대로 동작한다. */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const { url, key } = readSupabaseConfig(import.meta.env);
    client = createClient(url, key);
  }
  return client;
}
