/**
 * Ôn tập (G4): sinh quiz qua Edge Function, còn lại đọc/ghi SQLite cục bộ để chạy được khi mất mạng.
 * Mọi lần chấm ghi vào SQLite ngay (dirty=1) rồi `sync()` đẩy lên khi có mạng.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { asc, eq, inArray } from 'drizzle-orm';

import { type CardRow, db, type QuestionRow, type QuizRow, schema } from '@/db';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';

import { localDay, streakOf } from './progress';
import { buildQueue, type FsrsState, type Grade4, review, summarize } from './scheduler';
import { sync } from './sync';

export class StudyError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export type GenerateQuizInput = {
  document_id: string;
  from_page: number;
  to_page: number;
  n?: number;
};

export type GenerateQuizResult = {
  quiz_id: string;
  questions: unknown[];
  generated: number;
  dropped: Record<string, number>;
};

async function generateQuiz(input: GenerateQuizInput): Promise<GenerateQuizResult> {
  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) throw new StudyError('unauthorized', 'Chưa đăng nhập.');
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-quiz`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const { code, message, ...extra } = body as { code?: string; message?: string };
    throw new StudyError(code ?? 'internal', message ?? 'Lỗi máy chủ.', extra);
  }
  return body as unknown as GenerateQuizResult;
}

export const studyKeys = {
  quizzes: ['study', 'quizzes'] as const,
  queue: ['study', 'queue'] as const,
  progress: ['study', 'progress'] as const,
};

export function useGenerateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateQuiz,
    onSuccess: async (r, input) => {
      track('quiz_generated', {
        pages: input.to_page - input.from_page + 1,
        kept: r.questions.length,
        generated: r.generated,
      });
      await sync();
      await qc.invalidateQueries({ queryKey: ['study'] });
    },
  });
}

/** Kéo/đẩy khi có mạng rồi làm mới cache. Gọi lúc mở tab Ôn tập và sau mỗi phiên ôn. */
export function useSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sync,
    onSettled: () => qc.invalidateQueries({ queryKey: ['study'] }),
  });
}

export type QuizWithCount = QuizRow & { total: number; due: number; learned: number };

/** Danh sách bộ quiz cục bộ, kèm số thẻ và số đến hạn. */
export function useQuizzes() {
  return useQuery({
    queryKey: studyKeys.quizzes,
    queryFn: async (): Promise<QuizWithCount[]> => {
      const rows = db.select().from(schema.quizzes).orderBy(asc(schema.quizzes.generatedAt)).all();
      const now = new Date();
      return rows.map((q) => {
        const cs = cardsOfQuiz(q.id);
        const s = summarize(
          cs.map((c) => ({ state: c.fsrsState as FsrsState, due_at: c.dueAt })),
          now,
        );
        return { ...q, total: s.total, due: s.due + s.new, learned: s.learned };
      });
    },
  });
}

export type QueueItem = { card: CardRow; question: QuestionRow };

export type CardListItem = {
  id: string;
  stem: string;
  documentTitle: string;
  dueAt: string;
  state: number;
};

/** Mọi thẻ, sắp theo hạn — cho màn danh sách (G7.4). Một câu SQL join, không N+1. */
export function useAllCards() {
  return useQuery({
    queryKey: ['study', 'cards'],
    queryFn: async (): Promise<CardListItem[]> => {
      const rows = db
        .select({
          id: schema.cards.id,
          stem: schema.questions.stem,
          documentTitle: schema.quizzes.documentTitle,
          dueAt: schema.cards.dueAt,
          fsrsState: schema.cards.fsrsState,
        })
        .from(schema.cards)
        .innerJoin(schema.questions, eq(schema.questions.id, schema.cards.questionId))
        .innerJoin(schema.quizzes, eq(schema.quizzes.id, schema.questions.quizId))
        .orderBy(asc(schema.cards.dueAt))
        .all();
      return rows.map((r) => ({
        id: r.id,
        stem: r.stem,
        documentTitle: r.documentTitle,
        dueAt: r.dueAt,
        state: Number((r.fsrsState as FsrsState).state ?? 0),
      }));
    },
  });
}

/** Tài liệu của một bộ quiz (để mở trang nguồn từ thẻ). */
export function quizDocumentId(quizId: string): string | null {
  const row = db
    .select({ documentId: schema.quizzes.documentId })
    .from(schema.quizzes)
    .where(eq(schema.quizzes.id, quizId))
    .get();
  return row?.documentId ?? null;
}

function cardsOfQuiz(quizId: string): CardRow[] {
  const qids = db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(eq(schema.questions.quizId, quizId))
    .all()
    .map((r) => r.id);
  if (!qids.length) return [];
  return db.select().from(schema.cards).where(inArray(schema.cards.questionId, qids)).all();
}

/** Hàng ôn của một bộ (hoặc mọi bộ khi `quizId` null): đến hạn trước, rồi thẻ mới. Tính từ SQLite, không mạng. */
export function useQueue(quizId: string | null) {
  return useQuery({
    queryKey: [...studyKeys.queue, quizId],
    // Phiên ôn giữ nguyên hàng đã lấy; chỉ làm mới khi bị invalidate (xong phiên / sync).
    staleTime: Infinity,
    refetchOnMount: 'always',
    queryFn: async (): Promise<QueueItem[]> => {
      const cards = quizId ? cardsOfQuiz(quizId) : db.select().from(schema.cards).all();
      const ordered = buildQueue(
        cards.map((c) => ({ ...c, state: c.fsrsState as FsrsState, due_at: c.dueAt })),
      );
      if (!ordered.length) return [];
      const qs = db
        .select()
        .from(schema.questions)
        .where(
          inArray(
            schema.questions.id,
            ordered.map((c) => c.questionId),
          ),
        )
        .all();
      const byId = new Map(qs.map((q) => [q.id, q]));
      const out: QueueItem[] = [];
      for (const { state: _s, due_at: _d, ...card } of ordered) {
        const question = byId.get(card.questionId);
        if (question) out.push({ card, question });
      }
      return out;
    },
  });
}

/** Chấm một thẻ: FSRS → ghi SQLite (dirty) + nhật ký. Không gọi mạng; sync lo phần còn lại. */
export function gradeCard(card: CardRow, grade: Grade4, now: Date = new Date()): CardRow {
  const next = review({ state: card.fsrsState as FsrsState, due_at: card.dueAt }, grade, now);
  const updated: CardRow = {
    ...card,
    fsrsState: next.state as unknown as Record<string, unknown>,
    dueAt: next.due_at,
    updatedAt: now.toISOString(),
    dirty: 1,
  };
  db.transaction((tx) => {
    tx.update(schema.cards)
      .set({
        fsrsState: updated.fsrsState,
        dueAt: updated.dueAt,
        updatedAt: updated.updatedAt,
        dirty: 1,
      })
      .where(eq(schema.cards.id, card.id))
      .run();
    tx.insert(schema.reviewLog)
      .values({ cardId: card.id, grade, reviewedAt: now.toISOString() })
      .run();
  });
  return updated;
}

export type Progress = {
  due: number;
  new: number;
  learned: number;
  total: number;
  /** Số ngày liên tiếp có ôn, tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa ôn). */
  streak: number;
  reviewedToday: number;
};

/** Màn tiến độ (G4.8), tất cả từ SQLite. */
export function useProgress() {
  return useQuery({
    queryKey: studyKeys.progress,
    queryFn: async (): Promise<Progress> => {
      const now = new Date();
      const cards = db.select().from(schema.cards).all();
      const s = summarize(
        cards.map((c) => ({ state: c.fsrsState as FsrsState, due_at: c.dueAt })),
        now,
      );
      const days = new Set(
        db
          .select({ at: schema.reviewLog.reviewedAt })
          .from(schema.reviewLog)
          .all()
          .map((r) => localDay(new Date(r.at))),
      );
      return { ...s, streak: streakOf(days, now), reviewedToday: countToday(now) };
    },
  });
}

function countToday(now: Date): number {
  const today = localDay(now);
  return db
    .select({ at: schema.reviewLog.reviewedAt })
    .from(schema.reviewLog)
    .all()
    .filter((r) => localDay(new Date(r.at)) === today).length;
}
