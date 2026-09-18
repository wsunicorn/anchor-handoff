import { describe, expect, it } from 'vitest';

import { DAILY_COST_CEILING_USD, modelFor, type TierContext } from './tiering';

const ctx = (tier: 'free' | 'pro', daily: number): TierContext => ({
  tier,
  daily_cost_usd: daily,
  degraded: daily >= DAILY_COST_CEILING_USD[tier],
});

describe('modelFor (G6.3 định tuyến theo tầng, G6.6 ngắt mạch)', () => {
  it('pro trả lời bằng model mạnh, free bằng lite; verify/rerank luôn lite', () => {
    expect(modelFor('answer', ctx('pro', 0))).toBe('gemini-3.5-flash');
    expect(modelFor('answer', ctx('free', 0))).toBe('gemini-3.5-flash-lite');
    expect(modelFor('verify', ctx('pro', 0))).toBe('gemini-3.5-flash-lite');
  });
  it('quiz/grade dùng model mạnh cho cả free (một bộ / một bài) — chất lượng là giá trị cảm nhận', () => {
    expect(modelFor('quiz', ctx('free', 0))).toBe('gemini-3.5-flash');
    expect(modelFor('grade', ctx('free', 0))).toBe('gemini-3.5-flash');
  });
  it('vượt trần ngày → hạ xuống lite thay vì chặn, kể cả pro', () => {
    const hot = ctx('pro', DAILY_COST_CEILING_USD.pro);
    expect(hot.degraded).toBe(true);
    expect(modelFor('answer', hot)).toBe('gemini-3.5-flash-lite');
    expect(modelFor('quiz', hot)).toBe('gemini-3.5-flash-lite');
    expect(ctx('pro', DAILY_COST_CEILING_USD.pro - 0.01).degraded).toBe(false);
  });
});
