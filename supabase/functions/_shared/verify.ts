/**
 * Lớp kiểm chứng (SPEC §6, PROMPTS.md §2) — phần thuần: tách mệnh đề, quy điểm → nhãn,
 * dựng `VerifiedAnswer` mà UI được phép vẽ. Lời gọi model nằm ở Edge Function.
 */
import { type CitationSource, type Paragraph, parseAnswer } from './citations.ts';

export type Verdict = 'grounded' | 'inferred' | 'unsupported';

/** Ngưỡng SPEC §6: ≥ 0.75 grounded · 0.45–0.75 inferred · < 0.45 unsupported. */
export const GROUNDED_MIN = 0.75;
export const INFERRED_MIN = 0.45;
/** ADR-0001 trần kỹ thuật: kiểm chứng tối đa 12 mệnh đề mỗi câu trả lời. */
export const MAX_CLAIMS = 12;

export function toVerdict(score: number): Verdict {
  if (score >= GROUNDED_MIN) return 'grounded';
  if (score >= INFERRED_MIN) return 'inferred';
  return 'unsupported';
}

export type Claim = {
  /** Vị trí (đoạn, câu) trong parseAnswer — để gắn kết quả về đúng câu. */
  p: number;
  s: number;
  claim: string;
  citations: CitationSource[];
  chunk_text: string;
};

/** Mệnh đề cần model chấm: câu có trích dẫn. Câu `uncited` bị coi unsupported ngay, không tốn lời gọi. */
export function claimsOf(paragraphs: Paragraph[], chunkTexts: Record<string, string>): Claim[] {
  const out: Claim[] = [];
  paragraphs.forEach((para, p) => {
    para.sentences.forEach((sentence, s) => {
      if (!sentence.citations.length) return;
      out.push({
        p,
        s,
        claim: sentence.text,
        citations: sentence.citations,
        chunk_text: sentence.citations.map((c) => chunkTexts[c.chunk_id] ?? '').join('\n\n'),
      });
    });
  });
  return out;
}

export type VerifiedSentence = {
  text: string;
  verdict: Verdict;
  score: number;
  citations: CitationSource[];
};
export type VerifiedParagraph = {
  sentences: VerifiedSentence[];
  verdict: Exclude<Verdict, 'unsupported'>;
  page: number | null;
  chunkId: string | null;
};
export type VerifiedAnswer = {
  paragraphs: VerifiedParagraph[];
  insufficient: boolean;
  nearestPage: number | null;
  omitted: number;
};

/** Điểm model trả cho từng mệnh đề; thiếu điểm = unsupported (thà ẩn nhầm còn hơn lọt). */
export type ClaimScore = { i: number; score: number };

/**
 * Dựng câu trả lời đã kiểm chứng: mỗi câu mang verdict; câu `unsupported` (kể cả câu không có
 * trích dẫn, câu ngoài 12 mệnh đề đầu, câu model không chấm) bị **ẩn** và đếm vào `omitted`.
 * Đoạn không còn câu nào thì bỏ. Không còn đoạn nào → coi như insufficient, chỉ gợi ý trang gần nhất.
 */
export function buildVerifiedAnswer(
  paragraphs: Paragraph[],
  claims: Claim[],
  scores: ClaimScore[],
  nearestPage: number | null,
): VerifiedAnswer {
  const scoreAt = new Map<string, number>();
  scores.forEach(({ i, score }) => {
    const c = claims[i];
    if (c) scoreAt.set(`${c.p}:${c.s}`, clamp(score));
  });

  let omitted = 0;
  const out: VerifiedParagraph[] = [];
  paragraphs.forEach((para, p) => {
    const kept: VerifiedSentence[] = [];
    para.sentences.forEach((sentence, s) => {
      // Tiêu đề ngắn/câu hỏi tu từ không phải khẳng định: giữ nguyên, không cần chấm.
      if (!sentence.citations.length && !sentence.uncited) {
        kept.push({ text: sentence.text, verdict: 'grounded', score: 1, citations: [] });
        return;
      }
      const score = scoreAt.get(`${p}:${s}`);
      const verdict = score === undefined ? 'unsupported' : toVerdict(score);
      if (verdict === 'unsupported') {
        omitted += 1;
        return;
      }
      kept.push({ text: sentence.text, verdict, score: score ?? 0, citations: sentence.citations });
    });
    if (!kept.length) return;
    const first = kept.find((k) => k.citations.length)?.citations[0] ?? null;
    out.push({
      sentences: kept,
      verdict: kept.some((k) => k.verdict === 'inferred') ? 'inferred' : 'grounded',
      page: first?.page_no ?? null,
      chunkId: first?.chunk_id ?? null,
    });
  });

  // Chỉ còn tiêu đề/câu không khẳng định mà không có trích dẫn nào → không có gì để trả lời.
  const hasCited = out.some((p) => p.sentences.some((s) => s.citations.length));
  if (!hasCited) return { paragraphs: [], insufficient: true, nearestPage, omitted };
  return { paragraphs: out, insufficient: false, nearestPage, omitted };
}

function clamp(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/** Tiện ích cho Edge Function: từ văn bản thô + nguồn + điểm → VerifiedAnswer. */
export function verifyFromRaw(
  text: string,
  sources: Record<string, CitationSource>,
  chunkTexts: Record<string, string>,
  scores: ClaimScore[],
  nearestPage: number | null,
): { answer: VerifiedAnswer; claims: Claim[] } {
  const paragraphs = parseAnswer(text, sources);
  const claims = claimsOf(paragraphs, chunkTexts);
  return { answer: buildVerifiedAnswer(paragraphs, claims, scores, nearestPage), claims };
}

/** PROMPTS.md §2 — hệ thống cho `verify`. */
export const VERIFY_SYSTEM = [
  'Với mỗi cặp, xác định đoạn trích có chống lưng cho mệnh đề không.',
  '`grounded`: đoạn trích nêu trực tiếp điều đó.',
  '`inferred`: suy ra được bằng một bước lập luận hiển nhiên từ đoạn trích.',
  '`unsupported`: đoạn trích không nói điều này, hoặc nói khác.',
  'Đánh giá theo nội dung, không theo mức độ trôi chảy. Mệnh đề đúng trong thực tế nhưng không có trong đoạn trích vẫn là `unsupported`.',
  'Chỉ trả JSON: [{"i":0,"verdict":"grounded","score":0.91}, ...]. Không giải thích.',
].join('\n');

export function verifyUserPrompt(claims: Claim[]): string {
  return JSON.stringify(
    claims.map((c, i) => ({ i, claim: c.claim, chunk_text: c.chunk_text.slice(0, 3000) })),
  );
}

/** Đầu ra model có thể lệch format; chỉ giữ các phần tử hợp lệ. */
export function parseScores(text: string): ClaimScore[] {
  try {
    const arr = JSON.parse(text) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => {
        const o = x as { i?: unknown; score?: unknown; verdict?: unknown };
        const i = typeof o.i === 'number' ? o.i : Number.parseInt(String(o.i), 10);
        let score = typeof o.score === 'number' ? o.score : Number.parseFloat(String(o.score));
        // Model chỉ trả nhãn mà thiếu điểm: lấy giữa khoảng của nhãn đó.
        if (!Number.isFinite(score)) {
          score = o.verdict === 'grounded' ? 0.85 : o.verdict === 'inferred' ? 0.6 : 0;
        }
        return Number.isInteger(i) ? { i, score } : null;
      })
      .filter((x): x is ClaimScore => x !== null);
  } catch {
    return [];
  }
}
