import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export const profileKey = ['profile'] as const;

export function useProfile() {
  const userId = useSession((s) => s.session?.user.id);
  return useQuery({
    queryKey: profileKey,
    enabled: Boolean(userId),
    queryFn: async (): Promise<ProfileRow> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Đã đồng ý gửi dữ liệu tới nhà cung cấp AI chưa (SPEC §9). `undefined` = chưa biết. */
export function useAiConsent(): boolean | undefined {
  const { data } = useProfile();
  if (!data) return undefined;
  return data.ai_consent_at !== null;
}

/** Bật/tắt đồng ý. Server (ingest, Edge Function) tự kiểm `ai_consent_at`; đây chỉ là nguồn sự thật. */
export function useSetAiConsent() {
  const qc = useQueryClient();
  const userId = useSession((s) => s.session?.user.id);
  return useMutation({
    mutationFn: async (granted: boolean) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ai_consent_at: granted ? new Date().toISOString() : null })
        .eq('id', userId!);
      if (error) throw error;
      track(granted ? 'ai_consent_granted' : 'ai_consent_revoked');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: profileKey }),
  });
}

/**
 * G7.6 — xoá tài khoản thật: Edge Function xoá file Storage rồi auth.users (cascade toàn bộ), sau đó đăng
 * xuất cục bộ. Không có đường quay lại; UI phải hỏi xác nhận trước.
 */
export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error('unauthorized');
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  });
  if (!res.ok) throw new Error(`delete_account_${res.status}`);
  track('account_deleted');
  await supabase.auth.signOut();
}
