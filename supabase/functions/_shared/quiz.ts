/**
 * Sinh quiz (G4.1–G4.2) — hợp đồng prompt ở docs/PROMPTS.md §3. Sinh một lần rồi lưu (ADR-0001 §4.3).
 * Bộ lọc sau khi sinh chạy bằng code, không bằng model: trùng ý, đáp án lộ trong đề, đề quá ngắn,
 * citation không phân giải được.
 */

export const QUIZ_DEFAULT_N = 20;
export const QUIZ_MAX_N = 30;
/** Trần đoạn gửi cho model mỗi lần sinh (≈ 40k token) — chương dài hơn thì cắt theo thứ tự trang. */
export const QUIZ_MAX_CHUNKS = 60;
export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export type QuizChunk = {
  code: string;
  chunk_id: string;
  page_no: number;
  bboxes: number[][];
  text: string;
};

/** Câu hỏi đã qua parse, chưa lọc. `citation` là mã đoạn [cN] model chọn. */
export type RawQuestion = {
  stem: string;
  options: Record<OptionKey, string>;
  answer_key: OptionKey;
  explanation: string;
  citation: string;
};

export type FilteredQuestion = RawQuestion & {
  citation_source: { chunk_id: string; page_no: number; bboxes: number[][] };
  quality_score: number;
};

export type DropReason = 'short_stem' | 'answer_in_stem' | 'bad_citation' | 'duplicate';

const LANG_NAME: Record<'vi' | 'en', string> = { vi: 'tiếng Việt', en: 'English' };

/** PROMPTS.md §3 — hệ thống cho `generate-quiz`. */
export function quizSystemPrompt(n: number, lang: 'vi' | 'en'): string {
  return [
    `Sinh ${n} câu hỏi trắc nghiệm bốn lựa chọn từ các đoạn trích dưới đây.`,
    'Mỗi câu phải kiểm tra một ý riêng biệt — không hai câu hỏi cùng một ý.',
    'Đáp án không được xuất hiện nguyên văn trong đề.',
    'Ba đáp án sai phải là lỗi sai hợp lý mà người học thật sự mắc, không phải phương án vô lý.',
    'Mỗi câu kèm `citation` là mã đoạn nó lấy từ đó (dạng "c3"), và `explanation` giải thích vì sao đáp án đúng, diễn đạt lại chứ không chép nguyên đoạn.',
    `Ngôn ngữ câu hỏi: ${LANG_NAME[lang]} (theo ngôn ngữ tài liệu).`,
    'Chỉ trả JSON duy nhất, dạng: {"questions":[{"stem":"…","options":{"A":"…","B":"…","C":"…","D":"…"},"answer_key":"A","explanation":"…","citation":"c1"}]}.',
  ].join('\n');
}

export function quizUserPrompt(chunks: QuizChunk[]): string {
  const passages = chunks.map((c) => `[${c.code}] (trang ${c.page_no})\n${c.text}`).join('\n\n');
  return `ĐOẠN TRÍCH:\n\n${passages}`;
}

/** Parse JSON của model; phần tử hỏng bị bỏ, không ném lỗi. */
export function parseQuestions(text: string): RawQuestion[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { questions: salvageObjects(text) };
  }
  const list = Array.isArray(json) ? json : ((json as { questions?: unknown }).questions ?? null);
  if (!Array.isArray(list)) return [];
  const out: RawQuestion[] = [];
  for (const q of list as Record<string, unknown>[]) {
    if (!q || typeof q !== 'object') continue;
    const stem = str(q.stem);
    const explanation = str(q.explanation);
    const citation = str(q.citation)
      .replace(/[[\]\s]/g, '')
      .toLowerCase();
    const key = str(q.answer_key).trim().toUpperCase();
    const opts = q.options as Record<string, unknown> | undefined;
    if (!stem || !opts || typeof opts !== 'object') continue;
    const options = {} as Record<OptionKey, string>;
    let complete = true;
    for (const k of OPTION_KEYS) {
      const v = str(opts[k]);
      if (!v) complete = false;
      options[k] = v;
    }
    if (!complete || !(OPTION_KEYS as readonly string[]).includes(key)) continue;
    out.push({ stem, options, answer_key: key as OptionKey, explanation, citation });
  }
  return out;
}

/**
 * Đầu ra bị cắt (hết maxOutputTokens) thì JSON không đóng — vớt các object `{ "stem": … }` đã hoàn chỉnh
 * bằng cách đếm ngoặc (bỏ qua ngoặc trong chuỗi). Còn hơn mất cả bộ.
 */
export function salvageObjects(text: string): unknown[] {
  const out: unknown[] = [];
  let i = text.indexOf('{', text.indexOf('"questions"'));
  while (i >= 0) {
    let depth = 0;
    let inStr = false;
    let end = -1;
    for (let j = i; j < text.length; j += 1) {
      const ch = text[j];
      if (inStr) {
        if (ch === '\\') j += 1;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end < 0) break;
    try {
      out.push(JSON.parse(text.slice(i, end + 1)));
    } catch {
      // object hỏng giữa chừng — bỏ
    }
    i = text.indexOf('{', end + 1);
  }
  return out;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Đếm từ theo khoảng trắng — đủ cho ngưỡng "dưới 8 từ" của PROMPTS.md. */
export function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function norm(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Đáp án đúng nằm nguyên văn trong đề (bỏ qua đáp án quá ngắn như số hay một từ, vì trùng là tất yếu). */
export function answerInStem(q: RawQuestion): boolean {
  const ans = norm(q.options[q.answer_key]);
  if (wordCount(ans) < 3) return false;
  return norm(q.stem).includes(ans);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Dự phòng khi không có embedding: Jaccard trên tập từ của đề + đáp án đúng. */
export function jaccard(a: string, b: string): number {
  const A = new Set(
    norm(a)
      .split(' ')
      .filter((w) => w.length >= 2),
  );
  const B = new Set(
    norm(b)
      .split(' ')
      .filter((w) => w.length >= 2),
  );
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export const DUPLICATE_THRESHOLD = 0.85;
export const MIN_STEM_WORDS = 8;

/**
 * Bộ lọc G4.2 (PROMPTS.md §3). `embeddings[i]` là vector của câu i (cùng thứ tự với `questions`),
 * thiếu thì dùng Jaccard. Giữ câu đầu tiên trong mỗi cụm trùng. `quality_score` = 1 − độ giống lớn nhất
 * với các câu đã giữ (câu càng khác biệt điểm càng cao).
 */
export function filterQuestions(
  questions: RawQuestion[],
  sources: Record<string, QuizChunk>,
  embeddings?: (number[] | null)[],
): { kept: FilteredQuestion[]; dropped: { q: RawQuestion; reason: DropReason }[] } {
  const kept: FilteredQuestion[] = [];
  const keptIdx: number[] = [];
  const dropped: { q: RawQuestion; reason: DropReason }[] = [];
  const key = (q: RawQuestion) => `${q.stem} ${q.options[q.answer_key]}`;

  questions.forEach((q, i) => {
    if (wordCount(q.stem) < MIN_STEM_WORDS) return dropped.push({ q, reason: 'short_stem' });
    if (answerInStem(q)) return dropped.push({ q, reason: 'answer_in_stem' });
    const src = sources[q.citation];
    if (!src) return dropped.push({ q, reason: 'bad_citation' });

    let maxSim = 0;
    for (const j of keptIdx) {
      const ea = embeddings?.[i];
      const eb = embeddings?.[j];
      const sim = ea && eb ? cosine(ea, eb) : jaccard(key(q), key(questions[j]!));
      if (sim > maxSim) maxSim = sim;
    }
    if (maxSim >= DUPLICATE_THRESHOLD) return dropped.push({ q, reason: 'duplicate' });

    keptIdx.push(i);
    kept.push({
      ...q,
      citation_source: { chunk_id: src.chunk_id, page_no: src.page_no, bboxes: src.bboxes },
      quality_score: Number((1 - maxSim).toFixed(3)),
    });
  });
  return { kept, dropped };
}
