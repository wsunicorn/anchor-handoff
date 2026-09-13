/**
 * Parser trích dẫn (G2.5): chuyển văn bản có mã `[c3]` thành các đoạn (paragraph) gồm các
 * câu, mỗi câu gắn với danh sách trích dẫn có `page` + `bboxes`. Thuần, không I/O — dùng
 * chung cho Edge Function (Deno) và app (qua alias `@shared/*`), test bằng Vitest.
 */

export type BBox = [number, number, number, number];

export type CitationSource = {
  code: string; // "c3"
  chunk_id: string;
  page_no: number;
  bboxes: BBox[];
};

export type Sentence = {
  text: string; // đã bỏ mã [cN]
  citations: CitationSource[]; // theo thứ tự xuất hiện, không trùng
  /** Câu khẳng định không có mã nào — vi phạm hợp đồng prompt; verify() sẽ xử lý. */
  uncited: boolean;
};

export type Paragraph = { sentences: Sentence[] };

// Nhận cả `[c1]`, `[c1][c2]`, `[c1, c2]`, `[c1], [c2]`.
const CODE_RE = /\[(c\d+(?:\s*,\s*c\d+)*)\]/g;

/**
 * Tách văn bản thành câu. Một câu kết thúc ở dấu . ! ? … (không phải số thập phân) cộng
 * mọi mã [cN] đứng ngay sau đó — nên "trăm. [c1] Công thức" cắt sau "[c1]".
 * Viết tay thay vì regex lookbehind để chạy giống nhau trên Deno và Hermes.
 */
export function splitSentences(text: string): string[] {
  const src = text.trim();
  const out: string[] = [];
  let start = 0;
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    const isEnd = ch === '.' || ch === '!' || ch === '?' || ch === '…';
    // Chấm ngay sau chữ số ("3.14", "mục 7.1.", "năm 2004.") không kết thúc câu: cắt thừa làm
    // mảnh không mã bị ẩn (mất nội dung), gộp thừa chỉ làm câu dài hơn — chọn gộp.
    const afterDigit = ch === '.' && /\d/.test(src[i - 1] ?? '');
    if (!isEnd || afterDigit) {
      i += 1;
      continue;
    }
    // Nuốt chuỗi dấu câu liên tiếp rồi các mã [cN] (có thể cách bởi khoảng trắng).
    let j = i + 1;
    while (j < src.length && /[.!?…]/.test(src[j]!)) j += 1;
    for (;;) {
      const m = /^\s*,?\s*\[c\d+(?:\s*,\s*c\d+)*\]/.exec(src.slice(j));
      if (!m) break;
      j += m[0].length;
    }
    // Kết thúc câu nếu sau đó là khoảng trắng hoặc hết chuỗi.
    if (j >= src.length || /\s/.test(src[j]!)) {
      const sentence = src.slice(start, j).trim();
      if (sentence) out.push(sentence);
      while (j < src.length && /\s/.test(src[j]!)) j += 1;
      start = j;
    }
    i = j;
  }
  const tail = src.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function stripCodes(text: string): string {
  return text
    .replace(/\s*,?\s*\[c\d+(?:\s*,\s*c\d+)*\]/g, '')
    .replace(/\s+([.!?…,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Mã trong một câu, theo thứ tự xuất hiện, không trùng. */
export function codesIn(sentence: string): string[] {
  const seen = new Set<string>();
  for (const m of sentence.matchAll(CODE_RE)) {
    for (const code of (m[1] ?? '').split(',')) {
      const c = code.trim();
      if (c) seen.add(c);
    }
  }
  return [...seen];
}

/**
 * Parse toàn bộ câu trả lời. `sources` là bảng mã → nguồn (từ 6 đoạn đã gửi cho model).
 * Mã không có trong bảng (model bịa `[c9]`) bị bỏ qua và câu đó tính là `uncited`.
 */
export function parseAnswer(text: string, sources: Record<string, CitationSource>): Paragraph[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n+/g, ' ').trim())
    .filter(Boolean);

  return paragraphs.map((p) => ({
    sentences: splitSentences(p).map((raw) => {
      const citations = codesIn(raw)
        .map((code) => sources[code])
        .filter((c): c is CitationSource => Boolean(c));
      const cleaned = stripCodes(raw);
      return { text: cleaned, citations, uncited: citations.length === 0 && isClaim(cleaned) };
    }),
  }));
}

/** Câu hỏi tu từ, tiêu đề ngắn hay dòng danh sách không tính là khẳng định cần trích dẫn. */
function isClaim(sentence: string): boolean {
  const s = sentence.trim();
  if (s.length < 12) return false;
  if (/[?]$/.test(s)) return false;
  return true;
}

/** Câu trả lời có phải là từ chối theo hợp đồng (`INSUFFICIENT`) không. */
export function isInsufficient(text: string): boolean {
  return /^\s*INSUFFICIENT\s*[.!]?\s*$/i.test(text) || /^\s*INSUFFICIENT\b/.test(text.trim());
}

/**
 * Khoá cache (G2.7): sha256 tính ở nơi gọi; đây chỉ chuẩn hoá câu hỏi — NFC, thường hoá,
 * bỏ dấu câu và khoảng trắng thừa, để "Entropy là gì?" và "entropy là gì" chung một khoá.
 */
export function normalizeQuestion(question: string): string {
  return question
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
