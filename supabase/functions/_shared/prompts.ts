/**
 * Hợp đồng prompt — bám docs/PROMPTS.md. Sửa ở đó trước, sửa đây sau, rồi chạy `pnpm eval:rag`.
 * Không phụ thuộc đặc tính riêng của model (ADR-0001 cho phép đổi nhà cung cấp theo việc).
 */

export const MAX_ANSWER_TOKENS = 700;
export const MAX_CONTEXT_CHUNKS = 6;
export const RERANK_CANDIDATES = 20;
export const INSUFFICIENT = 'INSUFFICIENT';

const LANG_NAME: Record<'vi' | 'en', string> = { vi: 'tiếng Việt', en: 'English' };

/** PROMPTS.md §1 — hệ thống cho `ask`. */
export function askSystemPrompt(lang: 'vi' | 'en'): string {
  return [
    'Bạn trả lời chỉ dựa trên các đoạn trích được cung cấp từ tài liệu của người dùng.',
    'Mỗi câu khẳng định phải kết thúc bằng mã đoạn đã dùng, dạng [c3]. Câu nào không có đoạn nào chống lưng thì không được viết ra.',
    `Nếu các đoạn không đủ để trả lời, viết đúng một câu: ${INSUFFICIENT} — không đoán, không bổ sung kiến thức bên ngoài, không nói "theo hiểu biết chung".`,
    `Trả lời bằng ${LANG_NAME[lang]} kể cả khi tài liệu viết bằng ngôn ngữ khác. Giữ nguyên thuật ngữ chuyên ngành ở dạng gốc, giải nghĩa một lần ở lần xuất hiện đầu.`,
    `Tối đa ${MAX_ANSWER_TOKENS} token. Không mở đầu bằng lời chào hay tóm tắt câu hỏi.`,
  ].join('\n');
}

export type PromptChunk = { code: string; page: number; text: string };

/** Phần người dùng cho `ask`: các đoạn đã rerank kèm mã [c1]…[c6] và số trang, rồi câu hỏi. */
export function askUserPrompt(question: string, chunks: PromptChunk[]): string {
  const passages = chunks.map((c) => `[${c.code}] (trang ${c.page})\n${c.text}`).join('\n\n');
  return `ĐOẠN TRÍCH:\n\n${passages}\n\nCÂU HỎI: ${question}`;
}

/**
 * Rerank listwise (G2.3): một lời gọi cho toàn bộ ứng viên, trả JSON mảng chỉ số theo thứ tự
 * liên quan giảm dần. Thay cho cross-encoder vì hệ Gemini không có API rerank riêng.
 */
export function rerankPrompt(question: string, passages: string[], keep: number): string {
  const list = passages.map((p, i) => `#${i}: ${p}`).join('\n\n');
  return [
    `Xếp hạng các đoạn dưới đây theo mức độ chứa câu trả lời trực tiếp cho câu hỏi. Chỉ dựa vào nội dung đoạn.`,
    `Trả về JSON duy nhất: mảng ${keep} chỉ số nguyên, liên quan nhất trước, ví dụ [4,0,7,2,9,1]. Không giải thích.`,
    '',
    `CÂU HỎI: ${question}`,
    '',
    list,
  ].join('\n');
}
