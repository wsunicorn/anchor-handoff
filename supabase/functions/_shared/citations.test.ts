import { describe, expect, it } from 'vitest';

import {
  type CitationSource,
  codesIn,
  isInsufficient,
  normalizeQuestion,
  parseAnswer,
  splitSentences,
} from './citations';

const src = (code: string, page: number): CitationSource => ({
  code,
  chunk_id: `id-${code}`,
  page_no: page,
  bboxes: [[0, 0, 10, 10]],
});
const sources = { c1: src('c1', 84), c2: src('c2', 85), c3: src('c3', 90) };

describe('parseAnswer', () => {
  it('gắn mã cuối câu vào đúng câu, bỏ mã khỏi văn bản', () => {
    const p = parseAnswer('Độ co giãn là tỉ số phần trăm [c1]. Công thức ở trang sau [c2][c3].', sources);
    expect(p).toHaveLength(1);
    const [a, b] = p[0]!.sentences;
    expect(a!.text).toBe('Độ co giãn là tỉ số phần trăm.');
    expect(a!.citations.map((c) => c.page_no)).toEqual([84]);
    expect(b!.text).toBe('Công thức ở trang sau.');
    expect(b!.citations.map((c) => c.code)).toEqual(['c2', 'c3']);
    expect(a!.uncited).toBe(false);
  });

  it('mã đặt trước dấu chấm vẫn thuộc câu đó', () => {
    const p = parseAnswer('Năng lượng được bảo toàn [c1]. Entropy không giảm [c2].', sources);
    expect(p[0]!.sentences.map((s) => s.citations[0]!.code)).toEqual(['c1', 'c2']);
  });

  it('câu khẳng định không có mã → uncited; mã bịa [c9] bị bỏ', () => {
    const p = parseAnswer('Đây là một câu khẳng định không có nguồn nào cả. Câu này trích mã bịa [c9].', sources);
    expect(p[0]!.sentences[0]!.uncited).toBe(true);
    expect(p[0]!.sentences[1]!.citations).toEqual([]);
    expect(p[0]!.sentences[1]!.uncited).toBe(true);
    expect(p[0]!.sentences[1]!.text).toBe('Câu này trích mã bịa.');
  });

  it('tách đoạn theo dòng trống, không tách sau số thập phân', () => {
    const p = parseAnswer('Giá trị là 3.14 đơn vị [c1].\n\nĐoạn hai nói khác [c2].', sources);
    expect(p).toHaveLength(2);
    expect(p[0]!.sentences).toHaveLength(1);
    expect(p[0]!.sentences[0]!.text).toBe('Giá trị là 3.14 đơn vị.');
  });

  it('câu hỏi tu từ và tiêu đề ngắn không bị coi là thiếu trích dẫn', () => {
    const p = parseAnswer('Vì sao? Tóm lại [c1].', sources);
    expect(p[0]!.sentences[0]!.uncited).toBe(false);
  });
});

describe('helpers', () => {
  it('codesIn giữ thứ tự và bỏ trùng', () => {
    expect(codesIn('a [c2] b [c1] c [c2]')).toEqual(['c2', 'c1']);
  });

  it('splitSentences giữ mã liền sau dấu câu cho câu trước', () => {
    expect(splitSentences('A xong. [c1] B xong [c2].')).toEqual(['A xong. [c1]', 'B xong [c2].']);
  });

  it('isInsufficient nhận đúng từ chối, không nhận câu có chữ đó ở giữa', () => {
    expect(isInsufficient('INSUFFICIENT')).toBe(true);
    expect(isInsufficient('  insufficient.')).toBe(true);
    expect(isInsufficient('Dữ liệu là INSUFFICIENT để kết luận [c1].')).toBe(false);
  });

  it('normalizeQuestion gộp biến thể về một khoá', () => {
    expect(normalizeQuestion('Entropy   là gì?')).toBe(normalizeQuestion('entropy là gì'));
    expect(normalizeQuestion('Tiếng Việt!')).toBe('tiếng việt');
  });
});
