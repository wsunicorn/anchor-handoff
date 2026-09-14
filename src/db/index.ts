/**
 * Mở SQLite (expo-sqlite) và bọc Drizzle. Migration viết tay theo `PRAGMA user_version` — một mảng
 * câu lệnh, chỉ thêm vào cuối, không sửa câu cũ (cùng quy ước với supabase/migrations).
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

export const MIGRATIONS: string[] = [
  // v1 — G4.4
  `create table if not exists quizzes (
     id text primary key,
     document_id text not null,
     document_title text not null default '',
     scope text not null,
     generated_at text not null
   );
   create table if not exists questions (
     id text primary key,
     quiz_id text not null,
     stem text not null,
     options text not null,
     answer_key text not null,
     explanation text not null,
     citation text not null,
     quality_score real
   );
   create index if not exists questions_quiz_idx on questions (quiz_id);
   create table if not exists cards (
     id text primary key,
     question_id text not null unique,
     fsrs_state text not null,
     due_at text not null,
     updated_at text not null,
     dirty integer not null default 0
   );
   create index if not exists cards_due_idx on cards (due_at);
   create table if not exists review_log (
     id integer primary key autoincrement,
     card_id text not null,
     grade text not null,
     reviewed_at text not null
   );`,
];

export function migrate(sqlite: SQLiteDatabase): void {
  const row = sqlite.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v += 1) {
    sqlite.execSync(MIGRATIONS[v]!);
    sqlite.execSync(`PRAGMA user_version = ${v + 1}`);
  }
}

const sqlite = openDatabaseSync('anchor.db');
sqlite.execSync('PRAGMA journal_mode = WAL');
migrate(sqlite);

export const db = drizzle(sqlite, { schema });
export { schema };
export type { CardRow, QuestionRow, QuizRow } from './schema';
