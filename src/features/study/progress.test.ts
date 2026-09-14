import { describe, expect, it } from 'vitest';

import { localDay, streakOf } from './progress';

const day = (n: number) => new Date(2026, 8, 14 - n, 21, 0); // 14/9/2026 21:00 giờ máy

describe('streakOf', () => {
  it('đếm ngày liên tiếp tới hôm nay', () => {
    const days = new Set([0, 1, 2].map((n) => localDay(day(n))));
    expect(streakOf(days, day(0))).toBe(3);
  });
  it('hôm nay chưa ôn thì chuỗi chưa đứt, đếm từ hôm qua', () => {
    const days = new Set([1, 2].map((n) => localDay(day(n))));
    expect(streakOf(days, day(0))).toBe(2);
  });
  it('đứt một ngày là về 0 (hoặc chỉ hôm nay)', () => {
    expect(streakOf(new Set([localDay(day(2))]), day(0))).toBe(0);
    expect(streakOf(new Set([localDay(day(0)), localDay(day(2))]), day(0))).toBe(1);
  });
});
