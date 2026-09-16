/**
 * Lịch lặp lại ngắt quãng (G4.5) — bọc `ts-fsrs` (FSRS-5) thành hai việc: chấm một thẻ và xếp hàng ôn.
 * Trạng thái thẻ lưu dạng JSON (`cards.fsrs_state`) + `due_at` riêng, cùng hình dạng ở Supabase và SQLite,
 * để đồng bộ hai chiều (G4.4) không cần chuyển đổi. Không fuzz: lịch tất định, dễ kiểm và dễ đồng bộ.
 */
import {
  type Card,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Grade,
  Rating,
  State,
} from 'ts-fsrs';

export type Grade4 = 'again' | 'hard' | 'good' | 'easy';

/** Phần JSON của thẻ (không gồm `due`, vì `due_at` là cột riêng để đánh chỉ mục). */
export type FsrsState = {
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  /** 0 New · 1 Learning · 2 Review · 3 Relearning (giá trị enum của ts-fsrs). */
  state: number;
  last_review?: string;
};

export type SchedulerCard = { state: FsrsState; due_at: string };

const GRADE: Record<Grade4, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const params = generatorParameters({ enable_fuzz: false, enable_short_term: true });
const scheduler = fsrs(params);

/** Thẻ mới, đến hạn ngay. Cùng hình dạng với `NEW_CARD_STATE` ở Edge Function `generate-quiz`. */
export function newCard(now: Date = new Date()): SchedulerCard {
  return fromCard(createEmptyCard(now));
}

export function toCard(c: SchedulerCard): Card {
  const s = c.state;
  return {
    due: new Date(c.due_at),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days ?? 0,
    scheduled_days: s.scheduled_days ?? 0,
    learning_steps: s.learning_steps ?? 0,
    reps: s.reps ?? 0,
    lapses: s.lapses ?? 0,
    state: (s.state ?? 0) as State,
    ...(s.last_review ? { last_review: new Date(s.last_review) } : {}),
  };
}

export function fromCard(card: Card): SchedulerCard {
  return {
    due_at: card.due.toISOString(),
    state: {
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsed_days,
      scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      ...(card.last_review ? { last_review: card.last_review.toISOString() } : {}),
    },
  };
}

export type ReviewResult = SchedulerCard & {
  /** Khoảng cách đến lần ôn kế tiếp, tính bằng phút — để hiện "10 phút" / "3 ngày" trên nút. */
  interval_minutes: number;
};

/** Chấm một thẻ. Thuần: không đụng DB, không đụng đồng hồ máy ngoài `now`. */
export function review(card: SchedulerCard, grade: Grade4, now: Date = new Date()): ReviewResult {
  const { card: next } = scheduler.next(toCard(card), now, GRADE[grade]);
  return { ...fromCard(next), interval_minutes: minutesBetween(now, next.due) };
}

/** Khoảng cách kế tiếp cho cả bốn mức — nhãn nút trước khi người dùng chọn. */
export function preview(card: SchedulerCard, now: Date = new Date()): Record<Grade4, number> {
  const out = {} as Record<Grade4, number>;
  for (const g of Object.keys(GRADE) as Grade4[]) out[g] = review(card, g, now).interval_minutes;
  return out;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
}

/**
 * Trần thẻ mới mỗi phiên. Không dùng 20/ngày kiểu Anki: bộ quiz sinh theo chương (≤ 30 câu) là đơn vị
 * người học muốn ôn trọn một lần; trần chỉ để một thư viện nhiều bộ không dồn hàng trăm thẻ mới vào một phiên.
 */
export const NEW_PER_SESSION = 50;

/**
 * Hàng ôn của một phiên: thẻ đến hạn trước (đến hạn sớm nhất trước), rồi thẻ mới (tối đa
 * `newLimit`). Thẻ chưa đến hạn không xuất hiện — "đến hạn" là hợp đồng của FSRS, không bốc thêm cho đủ.
 */
export function buildQueue<T extends SchedulerCard>(
  cards: T[],
  now: Date = new Date(),
  newLimit: number = NEW_PER_SESSION,
): T[] {
  const t = now.getTime();
  const due = cards
    .filter((c) => c.state.state !== State.New && new Date(c.due_at).getTime() <= t)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const fresh = cards.filter((c) => c.state.state === State.New).slice(0, newLimit);
  return [...due, ...fresh];
}

/** Đếm cho màn tiến độ (G4.8): đến hạn, mới, đã học. */
export function summarize(cards: SchedulerCard[], now: Date = new Date()) {
  const t = now.getTime();
  let due = 0;
  let fresh = 0;
  let learned = 0;
  for (const c of cards) {
    if (c.state.state === State.New) fresh += 1;
    else {
      learned += 1;
      if (new Date(c.due_at).getTime() <= t) due += 1;
    }
  }
  return { due, new: fresh, learned, total: cards.length };
}
