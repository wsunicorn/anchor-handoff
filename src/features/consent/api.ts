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
