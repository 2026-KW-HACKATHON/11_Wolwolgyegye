import { getSupabaseClient } from '../../core/supabase/client';

export interface AdminOwnerApplication {
  id: string;
  applicant_name: string;
  applicant_email: string | null;
  contact_phone: string;
  store_name: string;
  store_address: string;
  requested_store_id: string | null;
  requested_store_phone: string | null;
  business_registration_number: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface AdminStore {
  id: string;
  name: string;
  cuisine_type: string | null;
  address: string;
  owner_id: string | null;
  is_published: boolean;
  is_demo: boolean;
}

function message(error: { message?: string } | null, fallback: string): string {
  if (!error?.message) return fallback;
  if (/Admin access required/i.test(error.message)) return '관리자 권한이 없습니다. 다시 로그인해 주세요.';
  if (/already reviewed/i.test(error.message)) return '이미 처리된 신청입니다. 목록을 새로고침해 주세요.';
  if (/another owner/i.test(error.message)) return '이미 다른 사장님과 연결된 가게입니다.';
  return fallback;
}

export async function fetchAdminDashboard(): Promise<{
  applications: AdminOwnerApplication[];
  stores: AdminStore[];
}> {
  const client = getSupabaseClient();
  const [applications, stores] = await Promise.all([
    client.rpc('admin_list_owner_applications', { p_status: 'all' }),
    client.rpc('admin_list_stores'),
  ]);
  if (applications.error) throw new Error(message(applications.error, '사장님 신청 목록을 불러오지 못했어요.'));
  if (stores.error) throw new Error(message(stores.error, '가게 목록을 불러오지 못했어요.'));
  return {
    applications: (applications.data ?? []) as AdminOwnerApplication[],
    stores: (stores.data ?? []) as AdminStore[],
  };
}

export async function reviewWithExistingStore(applicationId: string, storeId: string, note: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_review_owner_application', {
    p_application_id: applicationId,
    p_decision: 'approved',
    p_store_id: storeId,
    p_note: note,
  });
  if (error) throw new Error(message(error, '승인하지 못했어요. 입력 내용과 가게 상태를 확인해 주세요.'));
}

export async function rejectApplication(applicationId: string, note: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_review_owner_application', {
    p_application_id: applicationId,
    p_decision: 'rejected',
    p_store_id: null,
    p_note: note,
  });
  if (error) throw new Error(message(error, '신청을 반려하지 못했어요. 다시 시도해 주세요.'));
}

export async function setStorePublished(storeId: string, published: boolean): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_set_store_published', {
    p_store_id: storeId,
    p_is_published: published,
  });
  if (error) throw new Error(message(error, '가게 공개 상태를 변경하지 못했어요.'));
}
