/**
 * Edge Function `generate-quiz` (G4.1–G4.3): `{document_id, from_page, to_page, n?, lang?}` →
 * `{quiz_id, questions: [...], generated, dropped: {reason: count}, usage}`.
 *
 * Thứ tự: consent → sở hữu tài liệu → hạn mức (free: 1 bộ) → lấy chunk trong khoảng trang (trần 60)
 * → generate JSON một lượt (model mạnh hơn, ADR-0001) → nhúng đề một lượt → bộ lọc G4.2 (code)
 * → ghi quizzes/questions/cards/usage_costs. Sinh một lần rồi lưu; ôn không gọi lại LLM (G4.3).
 */
import { z } from 'npm:zod@3';

import { costUsd, embedBatch, generate } from '../_shared/gemini.ts';
import {
  adminClient,
  corsHeaders,
  errorResponse,
  HttpError,
  requireUser,
} from '../_shared/http.ts';
import {
  filterQuestions,
  parseQuestions,
  QUIZ_DEFAULT_N,
  QUIZ_MAX_CHUNKS,
  QUIZ_MAX_N,
  type QuizChunk,
  quizSystemPrompt,
  quizUserPrompt,
} from '../_shared/quiz.ts';
import { modelFor, tierContext } from '../_shared/tiering.ts';

const Body = z
  .object({
    document_id: z.string().uuid(),
    from_page: z.number().int().min(1),
    to_page: z.number().int().min(1),
    n: z.number().int().min(5).max(QUIZ_MAX_N).optional(),
    lang: z.enum(['vi', 'en']).optional(),
  })
  .refine((b) => b.to_page >= b.from_page, { message: 'to_page < from_page' });

const EMBEDDING_MODEL = Deno.env.get('EMBEDDING_MODEL') ?? 'gemini-embedding-2';
const EMBEDDING_DIM = 768;
const FREE_QUIZ_LIMIT = 1; // ADR-0001 §5

/** Trạng thái FSRS ban đầu (thẻ mới) — cùng hình dạng với ts-fsrs `createEmptyCard` ở app (G4.5). */
const NEW_CARD_STATE = {
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  reps: 0,
  lapses: 0,
  state: 0,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = adminClient();
  try {
    const userId = await requireUser(req, admin);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success)
      throw new HttpError(400, 'bad_request', 'Thiếu document_id hoặc khoảng trang không hợp lệ.');
    const { document_id, from_page, to_page } = parsed.data;
    const n = parsed.data.n ?? QUIZ_DEFAULT_N;

    const { data: profile } = await admin
      .from('profiles')
      .select('ai_consent_at')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.ai_consent_at)
      throw new HttpError(403, 'consent_required', 'Cần đồng ý sử dụng tính năng AI trước.');
    const tierCtx = await tierContext(admin, userId);
    const QUIZ_MODEL = modelFor('quiz', tierCtx);

    const { data: doc } = await admin
      .from('documents')
      .select('id, status, lang, page_count')
      .eq('id', document_id)
      .eq('owner', userId)
      .maybeSingle();
    if (!doc) throw new HttpError(404, 'not_found', 'Không tìm thấy tài liệu.');
    if (doc.status !== 'ready')
      throw new HttpError(409, 'document_not_ready', 'Tài liệu chưa xử lý xong.');
    if (to_page > doc.page_count)
      throw new HttpError(400, 'bad_request', `Tài liệu chỉ có ${doc.page_count} trang.`);
    const lang = parsed.data.lang ?? (doc.lang === 'en' ? 'en' : 'vi');

    // Hạn mức đếm ở server, trước khi gọi model (ADR-0001 §4.4).
    if (tierCtx.tier !== 'pro') {
      const { data: ownDocs } = await admin.from('documents').select('id').eq('owner', userId);
      const { count } = await admin
        .from('quizzes')
        .select('id', { count: 'exact', head: true })
        .in(
          'document_id',
          (ownDocs ?? []).map((d) => d.id as string),
        );
      if ((count ?? 0) >= FREE_QUIZ_LIMIT)
        throw new HttpError(403, 'quota_exceeded', 'Gói miễn phí chỉ sinh được một bộ quiz.', {
          used: count ?? 0,
          quota: FREE_QUIZ_LIMIT,
        });
    }

    const { data: rows, error: chunkErr } = await admin
      .from('chunks')
      .select('id, page_no, ord, text, bboxes')
      .eq('document_id', document_id)
      .gte('page_no', from_page)
      .lte('page_no', to_page)
      .order('page_no')
      .order('ord')
      .limit(QUIZ_MAX_CHUNKS);
    if (chunkErr) throw chunkErr;
    if (!rows?.length)
      throw new HttpError(
        422,
        'no_content',
        'Khoảng trang này không có nội dung chữ để sinh câu hỏi.',
      );

    const chunks: QuizChunk[] = rows.map((r, i) => ({
      code: `c${i + 1}`,
      chunk_id: r.id as string,
      page_no: r.page_no as number,
      bboxes: (r.bboxes as number[][]) ?? [],
      text: r.text as string,
    }));
    const sources = Object.fromEntries(chunks.map((c) => [c.code, c]));

    // Sinh một lượt. Quiz là việc "một lần rồi lưu" nên cho model nghĩ ở mức thấp thay vì tối thiểu.
    const gen = await generate(QUIZ_MODEL, quizSystemPrompt(n, lang), quizUserPrompt(chunks), {
      json: true,
      maxTokens: 8192,
      temperature: 0.4,
      thinkingLevel: 'low',
    });
    const raw = parseQuestions(gen.text);
    if (!raw.length)
      throw new HttpError(502, 'generation_failed', 'Model không trả về câu hỏi hợp lệ.');

    // Nhúng đề + đáp án đúng một lượt để lọc trùng ý (cosine ≥ 0.85). Lỗi nhúng thì lùi về Jaccard.
    let embeddings: number[][] | undefined;
    try {
      embeddings = await embedBatch(
        EMBEDDING_MODEL,
        raw.map((q) => `${q.stem} ${q.options[q.answer_key]}`),
        EMBEDDING_DIM,
      );
    } catch (e) {
      console.warn('embed_batch_failed', e);
    }
    const { kept, dropped } = filterQuestions(raw, sources, embeddings);
    if (!kept.length)
      throw new HttpError(
        502,
        'generation_failed',
        'Không câu hỏi nào qua được bộ lọc chất lượng.',
      );

    const { data: quiz, error: quizErr } = await admin
      .from('quizzes')
      .insert({ document_id, scope: { from_page, to_page, lang, n_requested: n } })
      .select('id')
      .single();
    if (quizErr || !quiz) throw quizErr ?? new Error('quiz_insert_failed');
    const quizId = quiz.id as string;

    const { data: inserted, error: qErr } = await admin
      .from('questions')
      .insert(
        kept.map((q) => ({
          quiz_id: quizId,
          stem: q.stem,
          options: q.options,
          answer_key: q.answer_key,
          explanation: q.explanation,
          citation: q.citation_source,
          quality_score: q.quality_score,
        })),
      )
      .select('id, stem, options, answer_key, explanation, citation, quality_score');
    if (qErr || !inserted) throw qErr ?? new Error('questions_insert_failed');

    const dueAt = new Date().toISOString();
    await admin.from('cards').insert(
      inserted.map((q) => ({
        owner: userId,
        question_id: q.id as string,
        fsrs_state: NEW_CARD_STATE,
        due_at: dueAt,
      })),
    );
    await admin.from('usage_costs').insert({
      owner: userId,
      feature: 'quiz',
      model: QUIZ_MODEL,
      ...gen.usage,
      cost_usd: costUsd(QUIZ_MODEL, gen.usage),
    });

    const droppedCount: Record<string, number> = {};
    for (const d of dropped) droppedCount[d.reason] = (droppedCount[d.reason] ?? 0) + 1;

    return new Response(
      JSON.stringify({
        quiz_id: quizId,
        questions: inserted,
        generated: raw.length,
        dropped: droppedCount,
        usage: gen.usage,
        degraded: tierCtx.degraded,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
});
