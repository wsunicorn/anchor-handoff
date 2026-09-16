import { describe, expect, it } from 'vitest';

import {
  buildFeedback,
  DEFAULT_RUBRIC,
  type GradeChunk,
  parseComments,
  type RawComment,
  splitEssay,
} from './grade';

const chunk = (code: string, page: number): GradeChunk => ({
  code,
  chunk_id: `id-${code}`,
  page_no: page,
  bboxes: [],
  text: `nội dung ${code}`,
});
const sources = { c1: chunk('c1', 2), c2: chunk('c2', 5) };

const raw = (over: Partial<RawComment> = {}): RawComment => ({
  name: 'Đúng nội dung',
  level: 'met',
  comment: 'Đoạn mở bài nêu đúng định nghĩa entropy như tài liệu.',
  essay_paragraph: 0,
  citation: 'c1',
  ...over,
});

describe('splitEssay', () => {
  it('tách theo dòng trống, gộp khoảng trắng, bỏ đoạn rỗng', () => {
    expect(splitEssay('A  a\n\n\nB b\r\n\r\nC')).toEqual(['A a', 'B b', 'C']);
  });
  it('không có dòng trống thì tách theo xuống dòng đơn', () => {
    expect(splitEssay('A\nB\nC')).toEqual(['A', 'B', 'C']);
  });
});

describe('parseComments', () => {
  it('chuẩn hoá level/citation, kẹp chỉ số đoạn vào [0, n-1], bỏ phần tử thiếu', () => {
    const out = parseComments(
      JSON.stringify({
        criteria: [
          { ...raw(), level: 'MET', citation: '[C1]', essay_paragraph: 7 },
          { ...raw(), level: 'excellent' },
          { name: 'x' },
        ],
      }),
      3,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ level: 'met', citation: 'c1', essay_paragraph: 2 });
    expect(parseComments('rác', 3)).toEqual([]);
  });
});

describe('buildFeedback (G5.4 — qua lớp kiểm chứng)', () => {
  it('ẩn nhận xét unsupported / không chấm / citation lạ; giữ grounded và inferred', () => {
    const comments = [
      raw(), // grounded
      raw({
        name: 'Đủ ý',
        level: 'partial',
        comment: 'Thiếu ý về nhiệt độ tuyệt đối.',
        citation: 'c2',
      }), // inferred
      raw({ name: 'Lập luận', level: 'unmet', comment: 'Bịa hoàn toàn.' }), // unsupported
      raw({ name: 'Diễn đạt', level: 'met', comment: 'Citation lạ.', citation: 'c9' }), // lạ
      raw({ name: 'Diễn đạt', level: 'partial', comment: 'Không được chấm.' }), // không có điểm
    ];
    const fb = buildFeedback(
      DEFAULT_RUBRIC,
      comments,
      sources,
      [
        { i: 0, score: 0.9 },
        { i: 1, score: 0.6 },
        { i: 2, score: 0.1 },
      ],
      2,
    );
    expect(fb.comments.map((c) => c.verdict)).toEqual(['grounded', 'inferred']);
    expect(fb.comments[1]!.citation.page_no).toBe(5);
    expect(fb.omitted).toBe(3);
    expect(fb.criteria.map((c) => c.level)).toEqual(['met', 'partial', 'partial', 'partial']);
    expect(fb.paragraph_count).toBe(2);
  });

  it('không nhận xét nào có căn cứ → không có gì hiển thị, mọi tiêu chí về partial', () => {
    const fb = buildFeedback(DEFAULT_RUBRIC, [raw()], sources, [{ i: 0, score: 0.2 }], 1);
    expect(fb.comments).toEqual([]);
    expect(fb.omitted).toBe(1);
    expect(fb.criteria.every((c) => c.level === 'partial')).toBe(true);
  });
});
