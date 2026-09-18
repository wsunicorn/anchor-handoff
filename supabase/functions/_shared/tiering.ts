/**
 * Định tuyến model theo tầng + ngắt mạch chi phí ngày (G6.3, G6.6; ADR-0001 §4 chốt chặn 6).
 * Tầng lấy từ `effective_tier()` (dùng thử/gói trả tiền/hết hạn) — không đọc cột `tier`.
 * Vượt trần chi phí ngày → hạ xuống model rẻ (`degraded: true`, app hiện thông báo trung thực) thay vì chặn.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type Tier = 'free' | 'pro';
export type Feature = 'answer' | 'rerank' | 'verify' | 'quiz' | 'grade' | 'ocr';

export type TierContext = {
  tier: Tier;
  /** USD đã tiêu hôm nay (UTC). */
  daily_cost_usd: number;
  /** Đã vượt trần ngày → mọi việc chạy model rẻ. */
  degraded: boolean;
};

/** Trần chi phí ngày (USD). Pro ≈ 1/30 doanh thu tháng gói năm; free đủ cho ~20 câu lite. */
export const DAILY_COST_CEILING_USD: Record<Tier, number> = { free: 0.05, pro: 0.5 };

// Đọc env qua globalThis để unit test (Vitest/Node) import được mà không có Deno.
const env = (k: string, fallback: string): string =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k) ??
  fallback;

/** Bảng model theo việc × tầng. Lite là sàn khi ngắt mạch. */
const MODELS: Record<Feature, { pro: string; free: string; cheap: string }> = {
  answer: {
    pro: env('LLM_MODEL_ANSWER_PRO', 'gemini-3.5-flash'),
    free: env('LLM_MODEL_ANSWER', 'gemini-3.5-flash-lite'),
    cheap: env('LLM_MODEL_ANSWER', 'gemini-3.5-flash-lite'),
  },
  rerank: {
    pro: env('LLM_MODEL_RERANK', 'gemini-3.5-flash-lite'),
    free: env('LLM_MODEL_RERANK', 'gemini-3.5-flash-lite'),
    cheap: env('LLM_MODEL_RERANK', 'gemini-3.5-flash-lite'),
  },
  verify: {
    pro: env('LLM_MODEL_VERIFY', 'gemini-3.5-flash-lite'),
    free: env('LLM_MODEL_VERIFY', 'gemini-3.5-flash-lite'),
    cheap: env('LLM_MODEL_VERIFY', 'gemini-3.5-flash-lite'),
  },
  // Quiz sinh một lần rồi lưu — chất lượng quyết định giá trị cảm nhận, free cũng dùng model mạnh (1 bộ).
  quiz: {
    pro: env('LLM_MODEL_QUIZ', 'gemini-3.5-flash'),
    free: env('LLM_MODEL_QUIZ', 'gemini-3.5-flash'),
    cheap: env('LLM_MODEL_VERIFY', 'gemini-3.5-flash-lite'),
  },
  grade: {
    pro: env('LLM_MODEL_GRADE', 'gemini-3.5-flash'),
    free: env('LLM_MODEL_GRADE', 'gemini-3.5-flash'),
    cheap: env('LLM_MODEL_VERIFY', 'gemini-3.5-flash-lite'),
  },
  ocr: {
    pro: env('LLM_MODEL_OCR', 'gemini-3.5-flash-lite'),
    free: env('LLM_MODEL_OCR', 'gemini-3.5-flash-lite'),
    cheap: env('LLM_MODEL_OCR', 'gemini-3.5-flash-lite'),
  },
};

export function modelFor(feature: Feature, ctx: TierContext): string {
  const m = MODELS[feature];
  if (ctx.degraded) return m.cheap;
  return ctx.tier === 'pro' ? m.pro : m.free;
}

/** Hai RPC service-role: tầng hiệu lực + chi phí hôm nay. Lỗi RPC → coi là free, không degraded. */
export async function tierContext(admin: SupabaseClient, userId: string): Promise<TierContext> {
  const [t, c] = await Promise.all([
    admin.rpc('effective_tier', { p_owner: userId }),
    admin.rpc('daily_cost_usd', { p_owner: userId }),
  ]);
  const tier: Tier = t.data === 'pro' ? 'pro' : 'free';
  const daily = Number(c.data ?? 0);
  return { tier, daily_cost_usd: daily, degraded: daily >= DAILY_COST_CEILING_USD[tier] };
}
