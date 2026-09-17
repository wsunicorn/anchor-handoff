/**
 * Chấm tự luận (G5): hai Edge Function — `transcribe-essay` (ảnh → chữ, người dùng sửa trước) và
 * `grade-essay` (nhận xét theo đoạn, đã qua lớp kiểm chứng G3). App chỉ vẽ `feedback` server trả về.
 */
import type { GradedFeedback, RubricCriterion } from '@shared/grade';
import { useMutation } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';

export type {
  DisplayLevel,
  GradedComment,
  GradedFeedback,
  Level,
  RubricCriterion,
} from '@shared/grade';

export class EssayError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) throw new EssayError('unauthorized', 'Chưa đăng nhập.');
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const { code, message, ...extra } = json as { code?: string; message?: string };
    throw new EssayError(code ?? 'internal', message ?? 'Lỗi máy chủ.', extra);
  }
  return json as T;
}

/** Ảnh chụp/chọn → nén về ≤ 1600px JPEG (ảnh gốc 12 MP quá lớn cho một request) → base64 → chữ. */
export function useTranscribe() {
  return useMutation({
    mutationFn: async (uri: string): Promise<string> => {
      const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      if (!out.base64) throw new EssayError('internal', 'Không đọc được ảnh.');
      const r = await callFunction<{ text: string }>('transcribe-essay', {
        image_base64: out.base64,
        mime_type: 'image/jpeg',
      });
      track('essay_transcribed', { chars: r.text.length });
      return r.text;
    },
  });
}

export type GradeInput = {
  document_id: string;
  body: string;
  rubric: RubricCriterion[];
  lang?: 'vi' | 'en';
};

export type GradeResult = {
  essay_id: string;
  feedback: GradedFeedback;
  paragraphs: string[];
  raw_comments: number;
};

export function useGradeEssay() {
  return useMutation({
    mutationFn: (input: GradeInput) => callFunction<GradeResult>('grade-essay', input),
    onSuccess: (r) =>
      track('essay_graded', {
        paragraphs: r.paragraphs.length,
        shown: r.feedback.comments.length,
        omitted: r.feedback.omitted,
      }),
  });
}
