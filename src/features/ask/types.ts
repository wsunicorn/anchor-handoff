import type { CitationSource } from '@shared/citations';

/**
 * Hình dạng duy nhất mà UI được phép vẽ (CLAUDE.md quy tắc 2): đầu ra của verify() ở G3.
 * Ở G2, màn Hỏi chỉ nhận fixture theo đúng kiểu này — không nối stream thô vào UI.
 */
export type Verdict = 'grounded' | 'inferred' | 'unsupported';

export type VerifiedSentence = {
  text: string;
  verdict: Verdict;
  score: number;
  citations: CitationSource[];
};

export type VerifiedParagraph = {
  sentences: VerifiedSentence[];
  /** Nhãn của thanh neo: mức thấp nhất trong các câu được hiển thị (grounded > inferred). */
  verdict: Exclude<Verdict, 'unsupported'>;
  /** Trang mà gạch chỉ trang ở cuối thanh trỏ tới: trang của trích dẫn đầu tiên. */
  page: number | null;
  chunkId: string | null;
};

export type VerifiedAnswer = {
  paragraphs: VerifiedParagraph[];
  insufficient: boolean;
  nearestPage: number | null;
  /** Số mệnh đề `unsupported` đã bị ẩn (SPEC §6) — hiển thị một dòng thay thế. */
  omitted: number;
};
