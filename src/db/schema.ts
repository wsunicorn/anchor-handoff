/**
 * Lược đồ SQLite cục bộ (G4.4) — bản sao phần ôn tập của Supabase (SPEC §4: quizzes/questions/cards)
 * để ôn khi mất mạng. JSON giữ nguyên hình dạng với Postgres nên đồng bộ không cần chuyển đổi.
 */
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const quizzes = sqliteTable('quizzes', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  documentTitle: text('document_title').notNull().default(''),
  scope: text('scope', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  generatedAt: text('generated_at').notNull(),
});

export const questions = sqliteTable('questions', {
  id: text('id').primaryKey(),
  quizId: text('quiz_id').notNull(),
  stem: text('stem').notNull(),
  options: text('options', { mode: 'json' }).$type<Record<string, string>>().notNull(),
  answerKey: text('answer_key').notNull(),
  explanation: text('explanation').notNull(),
  citation: text('citation', { mode: 'json' })
    .$type<{ chunk_id: string; page_no: number; bboxes: number[][] }>()
    .notNull(),
  qualityScore: real('quality_score'),
});

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  questionId: text('question_id').notNull().unique(),
  fsrsState: text('fsrs_state', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  dueAt: text('due_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  /** 1 = có thay đổi cục bộ chưa đẩy lên Supabase. */
  dirty: integer('dirty').notNull().default(0),
});

/** Nhật ký ôn — chỉ ghi thêm; dùng cho chuỗi ngày và độ phủ (G4.8). */
export const reviewLog = sqliteTable('review_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cardId: text('card_id').notNull(),
  grade: text('grade').notNull(),
  reviewedAt: text('reviewed_at').notNull(),
});

export type QuizRow = typeof quizzes.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type CardRow = typeof cards.$inferSelect;
