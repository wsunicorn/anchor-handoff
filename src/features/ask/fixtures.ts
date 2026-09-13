import type { VerifiedAnswer } from '@/features/ask/types';

/**
 * Fixture cho màn Hỏi ở G2 (chưa có verify()). Nội dung mô phỏng một câu trả lời đã qua
 * kiểm chứng: một đoạn có căn cứ, một đoạn suy luận, một mệnh đề bị ẩn.
 * `chunk_id`/`page_no` thay bằng dữ liệu thật khi màn Hỏi nối vào verify() ở G3.
 */
export function fixtureAnswer(pageA = 1, pageB = 2, chunkA = '', chunkB = ''): VerifiedAnswer {
  return {
    insufficient: false,
    nearestPage: null,
    omitted: 1,
    paragraphs: [
      {
        verdict: 'grounded',
        page: pageA,
        chunkId: chunkA || null,
        sentences: [
          {
            text: 'Năng lượng không tự sinh ra và không tự mất đi, chỉ chuyển hoá từ dạng này sang dạng khác.',
            verdict: 'grounded',
            score: 0.93,
            citations: [{ code: 'c1', chunk_id: chunkA, page_no: pageA, bboxes: [] }],
          },
          {
            text: 'Tổng năng lượng của một hệ kín là không đổi theo thời gian.',
            verdict: 'grounded',
            score: 0.9,
            citations: [{ code: 'c1', chunk_id: chunkA, page_no: pageA, bboxes: [] }],
          },
        ],
      },
      {
        verdict: 'inferred',
        page: pageB,
        chunkId: chunkB || null,
        sentences: [
          {
            text: 'Vì vậy khi bỏ qua ma sát, thế năng mất đi của quả bóng đúng bằng động năng nó nhận thêm.',
            verdict: 'inferred',
            score: 0.61,
            citations: [{ code: 'c2', chunk_id: chunkB, page_no: pageB, bboxes: [] }],
          },
        ],
      },
    ],
  };
}

export const fixtureInsufficient: VerifiedAnswer = {
  insufficient: true,
  nearestPage: 3,
  omitted: 0,
  paragraphs: [],
};
