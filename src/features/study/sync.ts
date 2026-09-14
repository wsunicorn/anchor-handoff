/**
 * Đồng bộ hai chiều phần ôn tập (G4.4). Nguồn sự thật khi ôn offline là SQLite; Supabase là bản lưu.
 *
 *  - pull(): tải quizzes/questions/cards của người dùng (RLS lọc) → upsert vào SQLite.
 *    Thẻ đang `dirty` (có lần ôn chưa đẩy) thì giữ bản cục bộ; thẻ sạch thì lấy bản mới hơn theo `updated_at`.
 *  - push(): đẩy mọi thẻ `dirty` bằng upsert theo khoá (owner, question_id) → không bao giờ nhân đôi;
 *    đẩy lại lần sau nếu lỗi. Thành công thì xoá cờ dirty.
 *
 * Quy tắc xung đột: bản có `updated_at` mới hơn thắng (LWW). Đủ cho một người học trên 1–2 máy.
 */
import { eq, inArray } from 'drizzle-orm';

import { db, schema } from '@/db';
import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type SyncResult = { pulled: number; pushed: number; failed: number };

export async function pull(): Promise<number> {
  const [{ data: quizzes, error: e1 }, { data: questions, error: e2 }, { data: cards, error: e3 }] =
    await Promise.all([
      supabase.from('quizzes').select('id, document_id, scope, generated_at, documents(title)'),
      supabase
        .from('questions')
        .select('id, quiz_id, stem, options, answer_key, explanation, citation, quality_score'),
      supabase.from('cards').select('id, question_id, fsrs_state, due_at, updated_at'),
    ]);
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;

  const dirtyIds = new Set(
    db
      .select({ questionId: schema.cards.questionId })
      .from(schema.cards)
      .where(eq(schema.cards.dirty, 1))
      .all()
      .map((r) => r.questionId),
  );
  const localUpdated = new Map(
    db
      .select({ questionId: schema.cards.questionId, updatedAt: schema.cards.updatedAt })
      .from(schema.cards)
      .all()
      .map((r) => [r.questionId, r.updatedAt]),
  );

  let n = 0;
  db.transaction((tx) => {
    for (const q of quizzes ?? []) {
      const doc = q.documents as { title: string } | null;
      tx.insert(schema.quizzes)
        .values({
          id: q.id,
          documentId: q.document_id,
          documentTitle: doc?.title ?? '',
          scope: (q.scope ?? {}) as Record<string, unknown>,
          generatedAt: q.generated_at,
        })
        .onConflictDoUpdate({
          target: schema.quizzes.id,
          set: {
            documentTitle: doc?.title ?? '',
            scope: (q.scope ?? {}) as Record<string, unknown>,
          },
        })
        .run();
      n += 1;
    }
    for (const q of questions ?? []) {
      tx.insert(schema.questions)
        .values({
          id: q.id,
          quizId: q.quiz_id,
          stem: q.stem,
          options: q.options as Record<string, string>,
          answerKey: q.answer_key,
          explanation: q.explanation,
          citation: q.citation as { chunk_id: string; page_no: number; bboxes: number[][] },
          qualityScore: q.quality_score,
        })
        .onConflictDoNothing()
        .run();
      n += 1;
    }
    for (const c of cards ?? []) {
      if (dirtyIds.has(c.question_id)) continue; // lần ôn cục bộ chưa đẩy — giữ
      const local = localUpdated.get(c.question_id);
      if (local && local >= c.updated_at) continue; // bản cục bộ mới bằng hoặc hơn
      tx.insert(schema.cards)
        .values({
          id: c.id,
          questionId: c.question_id,
          fsrsState: c.fsrs_state as Record<string, unknown>,
          dueAt: c.due_at,
          updatedAt: c.updated_at,
          dirty: 0,
        })
        .onConflictDoUpdate({
          target: schema.cards.questionId,
          set: {
            fsrsState: c.fsrs_state as Record<string, unknown>,
            dueAt: c.due_at,
            updatedAt: c.updated_at,
            dirty: 0,
          },
        })
        .run();
      n += 1;
    }
  });
  return n;
}

export async function push(): Promise<{ pushed: number; failed: number }> {
  const dirty = db.select().from(schema.cards).where(eq(schema.cards.dirty, 1)).all();
  if (!dirty.length) return { pushed: 0, failed: 0 };
  const { data: session } = await supabase.auth.getSession();
  const owner = session.session?.user.id;
  if (!owner) return { pushed: 0, failed: dirty.length };

  const { error } = await supabase.from('cards').upsert(
    dirty.map((c) => ({
      owner,
      question_id: c.questionId,
      fsrs_state: c.fsrsState as Json,
      due_at: c.dueAt,
      updated_at: c.updatedAt,
    })),
    { onConflict: 'owner,question_id' },
  );
  if (error) return { pushed: 0, failed: dirty.length };

  db.update(schema.cards)
    .set({ dirty: 0 })
    .where(
      inArray(
        schema.cards.questionId,
        dirty.map((c) => c.questionId),
      ),
    )
    .run();
  return { pushed: dirty.length, failed: 0 };
}

/** Đẩy trước rồi kéo — lần ôn offline lên trước, sau đó nhận thay đổi từ máy khác. Lỗi mạng thì im lặng. */
export async function sync(): Promise<SyncResult> {
  try {
    const p = await push();
    const pulled = await pull();
    return { pulled, ...p };
  } catch {
    return { pulled: 0, pushed: 0, failed: -1 };
  }
}
