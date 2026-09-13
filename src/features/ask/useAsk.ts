import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import type { VerifiedAnswer } from '@/features/ask/types';
import { AskError, askStream } from '@/lib/askClient';
import i18next from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';

const functionsUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type AskResult = {
  answer: VerifiedAnswer;
  cached: boolean;
};

/**
 * Gọi `ask` và chỉ trả về `VerifiedAnswer` (event `verified`). Delta thô bị bỏ qua — UI không
 * bao giờ thấy văn bản chưa kiểm chứng (CLAUDE.md quy tắc 2). Hạn mức được làm mới sau mỗi lượt.
 */
export function useAsk(documentId: string) {
  const qc = useQueryClient();
  const abort = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationFn: async (question: string): Promise<AskResult> => {
      abort.current?.abort();
      abort.current = new AbortController();
      const { data } = await supabase.auth.getSession();
      const jwt = data.session?.access_token;
      if (!jwt) throw new AskError('unauthorized', 'Chưa đăng nhập');

      const lang = i18next.language.startsWith('vi') ? 'vi' : 'en';
      track('ask_started', { lang });
      let verified: VerifiedAnswer | null = null;
      let cached = false;
      for await (const ev of askStream(
        functionsUrl,
        anonKey,
        jwt,
        { document_id: documentId, question, lang },
        abort.current.signal,
      )) {
        if (ev.type === 'verified') verified = ev.data.answer;
        else if (ev.type === 'done') cached = ev.data.cached;
        else if (ev.type === 'error') throw new AskError(ev.data.code, ev.data.message, ev.data);
      }
      if (!verified)
        throw new AskError('no_verified_answer', 'Máy chủ không trả kết quả đã kiểm chứng.');
      track('ask_answered', {
        insufficient: verified.insufficient,
        omitted: verified.omitted,
        paragraphs: verified.paragraphs.length,
        cached,
      });
      return { answer: verified, cached };
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['quota'] }),
  });

  return { ...mutation, cancel: () => abort.current?.abort() };
}
