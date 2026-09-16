/**
 * Edge Function `transcribe-essay` (G5.1): ảnh bài viết tay → chữ để người dùng sửa rồi mới chấm.
 * `{image_base64, mime_type}` → `{text}`. Cần consent (ảnh đi tới nhà cung cấp LLM — quy tắc 3).
 * Không lưu ảnh; không ghi text — chỉ trả về app.
 */
import { z } from 'npm:zod@3';

import { costUsd, transcribeImage } from '../_shared/gemini.ts';
import {
  adminClient,
  corsHeaders,
  errorResponse,
  HttpError,
  requireUser,
} from '../_shared/http.ts';

const Body = z.object({
  image_base64: z.string().min(100).max(6_000_000), // ≈ 4,5 MB ảnh — app đã nén về ~1600px
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

const OCR_MODEL = Deno.env.get('LLM_MODEL_OCR') ?? 'gemini-3.5-flash-lite';

const INSTRUCTION = [
  'Chép lại toàn bộ chữ viết tay trong ảnh thành văn bản thuần, giữ nguyên ngôn ngữ, thứ tự và cách chia đoạn (đoạn cách nhau bằng một dòng trống).',
  'Không sửa lỗi, không tóm tắt, không thêm chú thích. Chỗ không đọc được ghi [?].',
  'Nếu ảnh không có chữ, trả về chuỗi rỗng.',
].join('\n');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = adminClient();
  try {
    const userId = await requireUser(req, admin);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, 'bad_request', 'Thiếu ảnh hoặc ảnh quá lớn.');

    const { data: profile } = await admin
      .from('profiles')
      .select('ai_consent_at')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.ai_consent_at)
      throw new HttpError(403, 'consent_required', 'Cần đồng ý sử dụng tính năng AI trước.');

    const r = await transcribeImage(
      OCR_MODEL,
      parsed.data.mime_type,
      parsed.data.image_base64,
      INSTRUCTION,
    );
    await admin.from('usage_costs').insert({
      owner: userId,
      feature: 'ocr',
      model: OCR_MODEL,
      ...r.usage,
      cost_usd: costUsd(OCR_MODEL, r.usage),
    });
    return new Response(JSON.stringify({ text: stripPreamble(r.text) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return errorResponse(e);
  }
});

/** Model đôi khi mở đầu bằng "Dưới đây là nội dung…:" dù đã dặn — bỏ dòng dẫn kết thúc bằng dấu hai chấm. */
function stripPreamble(text: string): string {
  const t = text.trim();
  const m = /^[^\n]{0,160}:\s*\n+/.exec(t);
  return m ? t.slice(m[0].length).trim() : t;
}
