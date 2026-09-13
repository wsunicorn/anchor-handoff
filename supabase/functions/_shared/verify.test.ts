import { describe, expect, it } from 'vitest';

import type { CitationSource } from './citations';
import { claimsOf, parseScores, toVerdict, verifyFromRaw } from './verify';

const src = (code: string, page: number): CitationSource => ({
  code,
  chunk_id: `id-${code}`,
  page_no: page,
  bboxes: [[0, 0, 1, 1]],
});
const sources = { c1: src('c1', 84), c2: src('c2', 85) };
const chunkTexts = { 'id-c1': 'Độ co giãn là tỉ số phần trăm.', 'id-c2': 'Công thức ở trang 85.' };

describe('toVerdict', () => {
  it('quy đúng ngưỡng SPEC §6', () => {
    expect(toVerdict(0.75)).toBe('grounded');
    expect(toVerdict(0.749)).toBe('inferred');
    expect(toVerdict(0.45)).toBe('inferred');
    expect(toVerdict(0.449)).toBe('unsupported');
  });
});

describe('verifyFromRaw', () => {
  const text =
    'Độ co giãn là tỉ số phần trăm [c1]. Câu này bịa hoàn toàn không có nguồn nào cả. Công thức ở trang sau [c2].\n\nĐoạn hai chỉ có một câu bịa có mã [c1].';

  it('ẩn mệnh đề unsupported, đếm omitted, giữ câu grounded/inferred', () => {
    const { answer, claims } = verifyFromRaw(
      text,
      sources,
      chunkTexts,
      [
        { i: 0, score: 0.92 },
        { i: 1, score: 0.6 },
        { i: 2, score: 0.1 },
      ],
      84,
    );
    // 3 mệnh đề có trích dẫn được gửi đi chấm; câu không nguồn không tốn lời gọi.
    expect(claims.map((c) => c.claim)).toEqual([
      'Độ co giãn là tỉ số phần trăm.',
      'Công thức ở trang sau.',
      'Đoạn hai chỉ có một câu bịa có mã.',
    ]);
    expect(answer.insufficient).toBe(false);
    expect(answer.paragraphs).toHaveLength(1); // đoạn hai bị bỏ vì câu duy nhất unsupported
    const p = answer.paragraphs[0]!;
    expect(p.sentences.map((s) => s.verdict)).toEqual(['grounded', 'inferred']);
    expect(p.verdict).toBe('inferred'); // mức thấp nhất trong đoạn
    expect(p.page).toBe(84);
    expect(answer.omitted).toBe(2); // câu không nguồn + câu điểm 0.1
  });

  it('mệnh đề model không chấm → unsupported (thà ẩn nhầm)', () => {
    const { answer } = verifyFromRaw(
      'A đúng [c1]. B cũng đúng [c2].',
      sources,
      chunkTexts,
      [{ i: 0, score: 0.9 }],
      84,
    );
    expect(answer.paragraphs[0]!.sentences).toHaveLength(1);
    expect(answer.omitted).toBe(1);
  });

  it('không còn câu có trích dẫn nào → insufficient với trang gần nhất', () => {
    const { answer } = verifyFromRaw(
      'Câu bịa không có mã nào ở đây cả.',
      sources,
      chunkTexts,
      [],
      3,
    );
    expect(answer.insufficient).toBe(true);
    expect(answer.nearestPage).toBe(3);
    expect(answer.omitted).toBe(1);
  });

  it('chunk_text ghép từ mọi trích dẫn của câu', () => {
    const claims = claimsOf(
      [{ sentences: [{ text: 'x', citations: [sources.c1, sources.c2], uncited: false }] }],
      chunkTexts,
    );
    expect(claims[0]!.chunk_text).toContain('trang 85');
    expect(claims[0]!.chunk_text).toContain('tỉ số');
  });
});

describe('parseScores', () => {
  it('bỏ phần tử hỏng, suy điểm từ nhãn khi thiếu score', () => {
    expect(
      parseScores(
        '[{"i":0,"verdict":"grounded","score":0.9},{"i":"1","verdict":"inferred"},{"foo":1},{"i":2,"verdict":"unsupported"}]',
      ),
    ).toEqual([
      { i: 0, score: 0.9 },
      { i: 1, score: 0.6 },
      { i: 2, score: 0 },
    ]);
    expect(parseScores('không phải json')).toEqual([]);
  });
});
