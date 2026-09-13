/**
 * Hình dạng duy nhất mà UI được phép vẽ (CLAUDE.md quy tắc 2): đầu ra của verify() ở server.
 * Kiểu định nghĩa ở `supabase/functions/_shared/verify.ts` để server và app không lệch nhau.
 */
export type { Verdict, VerifiedAnswer, VerifiedParagraph, VerifiedSentence } from '@shared/verify';
