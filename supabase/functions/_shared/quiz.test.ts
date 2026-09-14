import { describe, expect, it } from 'vitest';

import {
  answerInStem,
  filterQuestions,
  jaccard,
  parseQuestions,
  type QuizChunk,
  type RawQuestion,
} from './quiz';

const chunk = (code: string, page: number): QuizChunk => ({
  code,
  chunk_id: `id-${code}`,
  page_no: page,
  bboxes: [[0, 0, 1, 1]],
  text: 'x',
});
const sources = { c1: chunk('c1', 3), c2: chunk('c2', 4) };

const q = (over: Partial<RawQuestion> = {}): RawQuestion => ({
  stem: 'Định luật Coulomb mô tả lực tương tác giữa hai điện tích điểm phụ thuộc vào đại lượng nào?',
  options: {
    A: 'Tích hai điện tích và bình phương khoảng cách',
    B: 'Tổng hai điện tích và khoảng cách',
    C: 'Hiệu hai điện tích và lập phương khoảng cách',
    D: 'Chỉ khoảng cách giữa hai điện tích',
  },
  answer_key: 'A',
  explanation: 'Lực tỉ lệ thuận với tích điện tích, tỉ lệ nghịch với bình phương khoảng cách.',
  citation: 'c1',
  ...over,
});

describe('parseQuestions', () => {
  it('nhận {"questions":[…]}, chuẩn hoá citation và answer_key, bỏ phần tử thiếu lựa chọn', () => {
    const text = JSON.stringify({
      questions: [
        { ...q(), citation: '[C1]', answer_key: 'a' },
        { ...q(), options: { A: 'x', B: 'y', C: 'z' } },
        { ...q(), answer_key: 'E' },
        'rác',
      ],
    });
    const out = parseQuestions(text);
    expect(out).toHaveLength(1);
    expect(out[0]!.citation).toBe('c1');
    expect(out[0]!.answer_key).toBe('A');
  });

  it('JSON hỏng → mảng rỗng', () => {
    expect(parseQuestions('không phải json')).toEqual([]);
  });

  it('đầu ra bị cắt giữa chừng → vớt các câu đã hoàn chỉnh', () => {
    const full = JSON.stringify({ questions: [q(), q({ citation: 'c2' }), q()] }, null, 2);
    const cut = full.slice(0, full.lastIndexOf('"explanation"') - 2);
    const out = parseQuestions(cut);
    expect(out).toHaveLength(2);
    expect(out[1]!.citation).toBe('c2');
  });
});

describe('answerInStem', () => {
  it('bắt đáp án dài nằm nguyên văn trong đề, bỏ qua đáp án ngắn', () => {
    expect(
      answerInStem(
        q({
          stem: 'Lực tỉ lệ với tích hai điện tích và bình phương khoảng cách — đó là định luật nào?',
        }),
      ),
    ).toBe(true);
    expect(answerInStem(q({ options: { ...q().options, A: '2' } }))).toBe(false);
  });
});

describe('filterQuestions (G4.2)', () => {
  it('loại đề ngắn, đáp án lộ, citation lạ, trùng ý; giữ câu đầu của cụm trùng', () => {
    const questions: RawQuestion[] = [
      q(),
      q({ stem: 'Coulomb là gì?' }),
      q({
        stem: 'Lực phụ thuộc tích hai điện tích và bình phương khoảng cách theo định luật nào?',
      }),
      q({ citation: 'c9' }),
      q({ stem: q().stem + ' ' }), // trùng ý hoàn toàn (Jaccard 1.0)
      q({
        stem: 'Điện trường tại một điểm được định nghĩa bằng đại lượng nào theo giáo trình?',
        options: {
          A: 'Lực trên một đơn vị điện tích thử',
          B: 'Công',
          C: 'Điện thế',
          D: 'Dòng điện',
        },
        citation: 'c2',
      }),
    ];
    const { kept, dropped } = filterQuestions(questions, sources);
    expect(kept.map((k) => k.citation_source.page_no)).toEqual([3, 4]);
    expect(dropped.map((d) => d.reason)).toEqual([
      'short_stem',
      'answer_in_stem',
      'bad_citation',
      'duplicate',
    ]);
    expect(kept[0]!.quality_score).toBe(1);
    expect(kept[1]!.quality_score).toBeLessThanOrEqual(1);
  });

  it('dùng embedding khi có: cosine ≥ 0.85 là trùng', () => {
    const questions = [
      q(),
      q({ stem: 'Một câu hỏi khác hẳn về chữ nhưng cùng ý theo vector nhúng của model?' }),
    ];
    const { kept, dropped } = filterQuestions(questions, sources, [
      [1, 0, 0],
      [0.95, 0.31, 0],
    ]);
    expect(kept).toHaveLength(1);
    expect(dropped[0]!.reason).toBe('duplicate');
  });
});

describe('jaccard', () => {
  it('0 khi rỗng, 1 khi giống hệt', () => {
    expect(jaccard('', 'a b')).toBe(0);
    expect(jaccard('điện trường tĩnh', 'điện trường tĩnh')).toBe(1);
  });
});
