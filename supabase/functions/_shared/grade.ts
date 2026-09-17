/**
 * Chấm tự luận (G5.2–G5.4) — hợp đồng prompt ở docs/PROMPTS.md §4. Phần thuần: rubric mặc định,
 * tách đoạn bài viết, parse JSON của model, ghép điểm kiểm chứng thành `GradedFeedback` mà UI được vẽ.
 * Không điểm số tuyệt đối (CLAUDE.md quy tắc 4): mỗi tiêu chí chỉ có mức đạt / một phần / chưa đạt.
 */
import type { BBox, CitationSource } from './citations.ts';
import { type Claim, type ClaimScore, toVerdict, type Verdict } from './verify.ts';

export type RubricCriterion = { name: string; weight: number };

/** G5.2 — bốn tiêu chí mặc định, trọng số người dùng sửa được (tổng không cần bằng 100). */
export const DEFAULT_RUBRIC: RubricCriterion[] = [
  { name: 'Đúng nội dung', weight: 40 },
  { name: 'Đủ ý', weight: 25 },
  { name: 'Lập luận', weight: 20 },
  { name: 'Diễn đạt', weight: 15 },
];

export const LEVELS = ['met', 'partial', 'unmet'] as const;
export type Level = (typeof LEVELS)[number];
/** Mức hiển thị: thêm `unverified` khi mọi nhận xét của tiêu chí bị ẩn — không dám nói đạt hay chưa. */
export type DisplayLevel = Level | 'unverified';

export const MAX_ESSAY_PARAGRAPHS = 12;
export const MAX_ESSAY_CHARS = 12_000;
/** Mỗi đoạn bài viết lấy tối đa ngần này đoạn tài liệu; toàn bài trần 10 đoạn (ADR-0001: ≤ 6 cho hỏi đáp; chấm cần rộng hơn). */
export const CHUNKS_PER_PARAGRAPH = 3;
export const MAX_GRADE_CHUNKS = 10;

/** Tách bài viết thành đoạn theo dòng trống (hoặc xuống dòng đơn nếu không có dòng trống). */
export function splitEssay(body: string): string[] {
  const norm = body.replace(/\r\n?/g, '\n').trim();
  let parts = norm.split(/\n\s*\n/);
  if (parts.length === 1) parts = norm.split(/\n/);
  return parts
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_ESSAY_PARAGRAPHS);
}

export type GradeChunk = {
  code: string;
  chunk_id: string;
  page_no: number;
  bboxes: BBox[];
  text: string;
};

const LANG_NAME: Record<'vi' | 'en', string> = { vi: 'tiếng Việt', en: 'English' };

/** PROMPTS.md §4 — hệ thống cho `grade-essay`. */
export function gradeSystemPrompt(rubric: RubricCriterion[], lang: 'vi' | 'en'): string {
  const names = rubric.map((r) => `"${r.name}" (trọng số ${r.weight})`).join(', ');
  return [
    'Chấm bài theo rubric được cung cấp, dựa trên tài liệu nguồn.',
    `Rubric gồm các tiêu chí: ${names}. Với mỗi tiêu chí, viết 1–3 nhận xét.`,
    'Mỗi nhận xét gắn với một đoạn cụ thể trong bài viết (theo chỉ số đoạn `essay_paragraph`, bắt đầu từ 0) và trích dẫn đoạn tài liệu làm căn cứ (mã `citation` dạng "c2").',
    'Nêu điều bài làm được trước, rồi điều thiếu. Chỉ ra chỗ sửa cụ thể, không viết lại bài hộ.',
    'Không chấm chính tả trừ khi rubric có tiêu chí đó.',
    'Không đưa ra điểm số tuyệt đối — `level` của mỗi tiêu chí chỉ là một trong: "met" (đạt), "partial" (một phần), "unmet" (chưa đạt).',
    'Mỗi nhận xét có hai phần: `comment` là đánh giá về bài viết; `evidence` là MỘT câu nêu tài liệu nói gì làm căn cứ, diễn đạt sát nguyên văn đoạn đã trích (không suy diễn). Hệ thống đối chiếu `evidence` với đoạn trích — không khớp thì cả nhận xét bị ẩn.',
    `Viết bằng ${LANG_NAME[lang]}.`,
    'Chỉ trả JSON: {"criteria":[{"name":"…","level":"met|partial|unmet","comment":"…","evidence":"…","essay_paragraph":0,"citation":"c1"}]}.',
  ].join('\n');
}

export function gradeUserPrompt(paragraphs: string[], chunks: GradeChunk[]): string {
  const essay = paragraphs.map((p, i) => `[đoạn ${i}] ${p}`).join('\n\n');
  const passages = chunks.map((c) => `[${c.code}] (trang ${c.page_no})\n${c.text}`).join('\n\n');
  return `TÀI LIỆU NGUỒN:\n\n${passages}\n\nBÀI VIẾT:\n\n${essay}`;
}

export type RawComment = {
  name: string;
  level: Level;
  comment: string;
  /** Tài liệu nói gì làm căn cứ — phần được lớp kiểm chứng đối chiếu với đoạn trích. */
  evidence: string;
  essay_paragraph: number;
  citation: string;
};

/** Parse JSON của model; phần tử hỏng bị bỏ. `citation` chuẩn hoá về "cN". */
export function parseComments(text: string, paragraphCount: number): RawComment[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  const list = (json as { criteria?: unknown }).criteria;
  if (!Array.isArray(list)) return [];
  const out: RawComment[] = [];
  for (const x of list as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object') continue;
    const name = str(x.name);
    const comment = str(x.comment);
    const evidence = str(x.evidence);
    const levelRaw = str(x.level).toLowerCase();
    const level = (LEVELS as readonly string[]).includes(levelRaw) ? (levelRaw as Level) : null;
    const para = Number(x.essay_paragraph);
    const citation = str(x.citation)
      .replace(/[[\]\s]/g, '')
      .toLowerCase();
    if (!name || !comment || !level || !Number.isInteger(para)) continue;
    out.push({
      name,
      level,
      comment,
      evidence,
      essay_paragraph: Math.min(Math.max(0, para), Math.max(0, paragraphCount - 1)),
      citation,
    });
  }
  return out;
}

/**
 * Mệnh đề cho lớp kiểm chứng G3: đối chiếu phần `evidence` (tài liệu nói gì) với đoạn nó trích.
 * Nhận xét về lập luận/diễn đạt của bài viết không phải mệnh đề về tài liệu — kiểm phần căn cứ của nó
 * mới đúng việc (quyết định 2026-09-17, xem PROMPTS.md §4). Thiếu `evidence` thì kiểm chính `comment`.
 */
export function commentClaims(
  comments: RawComment[],
  sources: Record<string, GradeChunk>,
): { claims: Claim[]; index: number[] } {
  const claims: Claim[] = [];
  const index: number[] = [];
  comments.forEach((c, i) => {
    const src = sources[c.citation];
    if (!src) return; // citation lạ → không chấm, ẩn (như câu uncited ở G3)
    claims.push({
      p: 0,
      s: i,
      claim: c.evidence || c.comment,
      citations: [
        { code: src.code, chunk_id: src.chunk_id, page_no: src.page_no, bboxes: src.bboxes },
      ],
      chunk_text: src.text,
    });
    index.push(i);
  });
  return { claims, index };
}

export type GradedComment = {
  criterion: string;
  comment: string;
  evidence: string;
  essay_paragraph: number;
  verdict: Exclude<Verdict, 'unsupported'>;
  score: number;
  citation: CitationSource;
};

export type GradedCriterion = { name: string; weight: number; level: DisplayLevel };

export type GradedFeedback = {
  criteria: GradedCriterion[];
  comments: GradedComment[];
  /** Nhận xét bị ẩn vì không có căn cứ trong tài liệu (mức 3) hoặc citation không phân giải được. */
  omitted: number;
  paragraph_count: number;
};

/**
 * G5.4: ghép điểm kiểm chứng. Nhận xét `unsupported`, không được chấm, hoặc citation lạ → ẩn, đếm vào
 * `omitted`. Mức của tiêu chí lấy theo nhận xét đầu tiên còn hiển thị của tiêu chí đó; tiêu chí không còn
 * nhận xét nào thì `unverified` (không dám nói đạt hay chưa khi mọi căn cứ đều bị ẩn).
 */
export function buildFeedback(
  rubric: RubricCriterion[],
  comments: RawComment[],
  sources: Record<string, GradeChunk>,
  scores: ClaimScore[],
  paragraphCount: number,
): GradedFeedback {
  const { claims, index } = commentClaims(comments, sources);
  const scoreOf = new Map(scores.map((s) => [s.i, s.score]));
  const kept: GradedComment[] = [];
  let omitted = comments.length - claims.length;
  claims.forEach((cl, k) => {
    const score = scoreOf.get(k);
    const verdict = score === undefined ? 'unsupported' : toVerdict(score);
    if (verdict === 'unsupported') {
      omitted += 1;
      return;
    }
    const c = comments[index[k]!]!;
    kept.push({
      criterion: c.name,
      comment: c.comment,
      evidence: c.evidence,
      essay_paragraph: c.essay_paragraph,
      verdict,
      score: score ?? 0,
      citation: cl.citations[0]!,
    });
  });
  const criteria = rubric.map((r) => {
    const first = comments.find(
      (c) =>
        c.name === r.name && kept.some((k) => k.criterion === c.name && k.comment === c.comment),
    );
    const level: DisplayLevel = first?.level ?? 'unverified';
    return { name: r.name, weight: r.weight, level };
  });
  return { criteria, comments: kept, omitted, paragraph_count: paragraphCount };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
