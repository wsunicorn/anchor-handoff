/**
 * Edge Function `grade-essay` (G5.3–G5.4): `{document_id, body, rubric?, lang?}` →
 * `{essay_id, feedback: GradedFeedback, paragraphs, usage}`.
 *
 * Thứ tự: consent → sở hữu tài liệu → hạn mức (free 1 bài, pro 60/tháng, đếm ở server) → tách đoạn
 * → nhúng từng đoạn (một lời gọi batch) → search_chunks RRF mỗi đoạn, gộp ≤ 10 đoạn tài liệu
 * → generate JSON (model mạnh nhất, ADR-0001) → **verify một lượt** mọi nhận xét (đúng lớp G3, ≤ 12)
 * → ẩn nhận xét không có căn cứ → ghi essays/usage_costs. Không điểm số tuyệt đối (quy tắc 4).
 */
import { z } from 'npm:zod@3';

import { costUsd, embedBatch, generate } from '../_shared/gemini.ts';
import {
  buildFeedback,
  CHUNKS_PER_PARAGRAPH,
  commentClaims,
  DEFAULT_RUBRIC,
  type GradeChunk,
  gradeSystemPrompt,
  gradeUserPrompt,
  MAX_ESSAY_CHARS,
  MAX_GRADE_CHUNKS,
  parseComments,
  splitEssay,
} from '../_shared/grade.ts';
import {
  adminClient,
  corsHeaders,
  errorResponse,
  HttpError,
  requireUser,
} from '../_shared/http.ts';
import { MAX_CLAIMS, parseScores, VERIFY_SYSTEM, verifyUserPrompt } from '../_shared/verify.ts';

const Body = z.object({
  document_id: z.string().uuid(),
  body: z.string().trim().min(40).max(MAX_ESSAY_CHARS),
  rubric: z
    .array(z.object({ name: z.string().trim().min(1).max(60), weight: z.number().min(0).max(100) }))
    .min(1)
    .max(8)
    .optional(),
  lang: z.enum(['vi', 'en']).optional(),
  // Chỉ eval dùng: trả thêm nhận xét thô + điểm kiểm chứng để soi vì sao bị ẩn.
  debug: z.boolean().optional(),
});

// ADR-0001: chấm dùng model mạnh nhất. 3.8-flash (nhận thinkingLevel low) chưa kiểm được vì hết quota ngày → tạm 3.5-flash.
const GRADE_MODEL = Deno.env.get('LLM_MODEL_GRADE') ?? 'gemini-3.5-flash';
const VERIFY_MODEL = Deno.env.get('LLM_MODEL_VERIFY') ?? 'gemini-3.5-flash-lite';
const EMBEDDING_MODEL = Deno.env.get('EMBEDDING_MODEL') ?? 'gemini-embedding-2';
const EMBEDDING_DIM = 768;
// ADR-0001 §5: free 1 bài, pro 60 / tháng.
const QUOTA = { free: 1, pro: 60 } as const;

type ChunkRow = { chunk_id: string; page_no: number; text: string; bboxes: unknown; score: number };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = adminClient();
  try {
    const userId = await requireUser(req, admin);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success)
      throw new HttpError(400, 'bad_request', 'Thiếu document_id hoặc bài viết quá ngắn/quá dài.');
    const { document_id, body } = parsed.data;
    const rubric = parsed.data.rubric ?? DEFAULT_RUBRIC;

    const { data: profile } = await admin
      .from('profiles')
      .select('ai_consent_at, tier')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.ai_consent_at)
      throw new HttpError(403, 'consent_required', 'Cần đồng ý sử dụng tính năng AI trước.');

    const { data: doc } = await admin
      .from('documents')
      .select('id, status, lang')
      .eq('id', document_id)
      .eq('owner', userId)
      .maybeSingle();
    if (!doc) throw new HttpError(404, 'not_found', 'Không tìm thấy tài liệu.');
    if (doc.status !== 'ready')
      throw new HttpError(409, 'document_not_ready', 'Tài liệu chưa xử lý xong.');
    const lang = parsed.data.lang ?? (doc.lang === 'en' ? 'en' : 'vi');

    const tier = profile.tier === 'pro' ? 'pro' : 'free';
    const since = tier === 'pro' ? new Date(new Date().setDate(1)).toISOString() : '1970-01-01';
    const { count } = await admin
      .from('usage_costs')
      .select('id', { count: 'exact', head: true })
      .eq('owner', userId)
      .eq('feature', 'grade')
      .gte('created_at', since);
    if ((count ?? 0) >= QUOTA[tier])
      throw new HttpError(403, 'quota_exceeded', 'Hết lượt chấm bài.', {
        used: count ?? 0,
        quota: QUOTA[tier],
      });

    const paragraphs = splitEssay(body);
    if (!paragraphs.length) throw new HttpError(400, 'bad_request', 'Bài viết trống.');

    // Truy hồi theo từng đoạn bài viết: nhúng một lượt, rồi RRF từng đoạn, gộp và giữ thứ tự trang.
    const embeddings = await embedBatch(
      EMBEDDING_MODEL,
      paragraphs,
      EMBEDDING_DIM,
      undefined,
      'RETRIEVAL_QUERY',
    );
    const byId = new Map<string, ChunkRow>();
    for (let i = 0; i < paragraphs.length; i += 1) {
      const { data: rows, error } = await admin.rpc('search_chunks', {
        p_document_id: document_id,
        p_query: paragraphs[i]!,
        p_embedding: JSON.stringify(embeddings[i]),
        p_limit: CHUNKS_PER_PARAGRAPH,
      });
      if (error) throw error;
      for (const r of (rows ?? []) as ChunkRow[]) {
        const prev = byId.get(r.chunk_id);
        if (!prev || prev.score < r.score) byId.set(r.chunk_id, r);
      }
    }
    const top = [...byId.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_GRADE_CHUNKS)
      .sort((a, b) => a.page_no - b.page_no);
    if (!top.length)
      throw new HttpError(422, 'no_content', 'Tài liệu không có đoạn nào liên quan tới bài viết.');

    const chunks: GradeChunk[] = top.map((c, i) => ({
      code: `c${i + 1}`,
      chunk_id: c.chunk_id,
      page_no: c.page_no,
      bboxes: (c.bboxes as GradeChunk['bboxes']) ?? [],
      text: c.text,
    }));
    const sources = Object.fromEntries(chunks.map((c) => [c.code, c]));

    const gen = await generate(
      GRADE_MODEL,
      gradeSystemPrompt(rubric, lang),
      gradeUserPrompt(paragraphs, chunks),
      { json: true, maxTokens: 4096, temperature: 0.2, thinkingLevel: 'low' },
    );
    const comments = parseComments(gen.text, paragraphs.length).slice(0, MAX_CLAIMS);
    if (!comments.length)
      throw new HttpError(502, 'generation_failed', 'Model không trả về nhận xét hợp lệ.');

    // Lớp kiểm chứng G3, đúng prompt và ngưỡng của `ask` — một lời gọi cho mọi nhận xét.
    const { claims } = commentClaims(comments, sources);
    let scores: ReturnType<typeof parseScores> = [];
    let verifyUsage = null as { tokens_in: number; tokens_out: number } | null;
    if (claims.length) {
      const v = await generate(VERIFY_MODEL, VERIFY_SYSTEM, verifyUserPrompt(claims), {
        json: true,
        maxTokens: 512,
      });
      verifyUsage = v.usage;
      scores = parseScores(v.text);
    }
    const feedback = buildFeedback(rubric, comments, sources, scores, paragraphs.length);

    const { data: essay, error: essayErr } = await admin
      .from('essays')
      .insert({ owner: userId, document_id, body, rubric, feedback })
      .select('id')
      .single();
    if (essayErr || !essay) throw essayErr ?? new Error('essay_insert_failed');

    const costRows = [
      {
        owner: userId,
        feature: 'grade',
        model: GRADE_MODEL,
        ...gen.usage,
        cost_usd: costUsd(GRADE_MODEL, gen.usage),
      },
    ];
    if (verifyUsage)
      costRows.push({
        owner: userId,
        feature: 'verify',
        model: VERIFY_MODEL,
        ...verifyUsage,
        cost_usd: costUsd(VERIFY_MODEL, verifyUsage),
      });
    await admin.from('usage_costs').insert(costRows);

    return new Response(
      JSON.stringify({
        essay_id: essay.id,
        feedback,
        paragraphs,
        raw_comments: comments.length,
        usage: gen.usage,
        ...(parsed.data.debug
          ? { debug: { comments, scores, codes: chunks.map((c) => `${c.code}:p${c.page_no}`) } }
          : {}),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
});
