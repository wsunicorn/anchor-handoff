import { describe, expect, it } from 'vitest';

import { buildQueue, newCard, preview, review, summarize, toCard } from './scheduler';

const T0 = new Date('2026-09-14T08:00:00Z');
const min = (n: number) => new Date(T0.getTime() + n * 60_000);
const day = (n: number) => min(n * 24 * 60);

describe('review (FSRS-5 qua ts-fsrs)', () => {
  it('thẻ mới có due ngay và hình dạng JSON khớp NEW_CARD_STATE của generate-quiz', () => {
    const c = newCard(T0);
    expect(c.due_at).toBe(T0.toISOString());
    expect(c.state).toMatchObject({ reps: 0, lapses: 0, state: 0, stability: 0, difficulty: 0 });
    // Trạng thái server ghi ra (không có learning_steps/last_review) vẫn đọc được.
    const fromServer = toCard({
      due_at: T0.toISOString(),
      state: {
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0,
      } as never,
    });
    expect(fromServer.learning_steps).toBe(0);
  });

  it('Good trên thẻ mới → Learning, ôn lại sau khoảng 10 phút; Good lần nữa → Review ≥ 1 ngày', () => {
    const a = review(newCard(T0), 'good', T0);
    expect(a.state.state).toBe(1);
    expect(a.state.reps).toBe(1);
    expect(a.interval_minutes).toBeGreaterThanOrEqual(5);
    expect(a.interval_minutes).toBeLessThanOrEqual(15);

    const b = review(a, 'good', min(a.interval_minutes));
    expect(b.state.state).toBe(2);
    expect(b.interval_minutes).toBeGreaterThanOrEqual(24 * 60);
  });

  it('Easy cho khoảng cách dài hơn Good; Again ngắn hơn Hard', () => {
    const p = preview(newCard(T0), T0);
    expect(p.again).toBeLessThan(p.hard);
    expect(p.hard).toBeLessThanOrEqual(p.good);
    expect(p.good).toBeLessThan(p.easy);
  });

  it('Again trên thẻ Review → Relearning, lapses +1, stability giảm', () => {
    let c = review(newCard(T0), 'good', T0);
    c = review(c, 'good', min(c.interval_minutes));
    expect(c.state.state).toBe(2);
    const s0 = c.state.stability;
    const lapsed = review(c, 'again', day(3));
    expect(lapsed.state.state).toBe(3);
    expect(lapsed.state.lapses).toBe(1);
    expect(lapsed.state.stability).toBeLessThan(s0);
    expect(lapsed.interval_minutes).toBeLessThan(24 * 60);
  });

  it('tất định: cùng đầu vào cho cùng lịch (không fuzz)', () => {
    const x = review(newCard(T0), 'easy', T0);
    const y = review(newCard(T0), 'easy', T0);
    expect(x).toEqual(y);
  });

  it('khoảng cách tăng dần khi ôn đúng liên tiếp', () => {
    let c = review(newCard(T0), 'good', T0);
    let at = min(c.interval_minutes);
    const intervals: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      c = review(c, 'good', at);
      intervals.push(c.interval_minutes);
      at = new Date(at.getTime() + c.interval_minutes * 60_000);
    }
    for (let i = 1; i < intervals.length; i += 1)
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]!);
  });
});

describe('buildQueue / summarize', () => {
  it('đến hạn trước (sớm nhất trước), rồi thẻ mới tối đa newLimit; thẻ chưa đến hạn không vào hàng', () => {
    const later = review(newCard(T0), 'good', T0); // Learning, due ~10 phút sau
    const dueOld = { ...later, due_at: day(-2).toISOString() };
    const dueNew = { ...later, due_at: day(-1).toISOString() };
    const fresh = [newCard(T0), newCard(T0), newCard(T0)];
    const q = buildQueue([fresh[0]!, later, dueNew, fresh[1]!, dueOld, fresh[2]!], T0, 2);
    expect(q.map((c) => c.due_at)).toEqual([
      dueOld.due_at,
      dueNew.due_at,
      fresh[0]!.due_at,
      fresh[1]!.due_at,
    ]);
    expect(summarize([fresh[0]!, later, dueNew, dueOld], T0)).toEqual({
      due: 2,
      new: 1,
      learned: 3,
      total: 4,
    });
  });
});
