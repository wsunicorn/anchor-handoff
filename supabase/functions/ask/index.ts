/**
 * Edge Function `ask` (G2.1): `{document_id, question, lang}` → SSE.
 *
 *   event: meta   {conversation_id, citations: {c1: {chunk_id, page_no, bboxes}, …}}
 *   event: delta  {text}
 *   event: verified {answer: VerifiedAnswer}   ← thứ duy nhất app được vẽ (CLAUDE.md quy tắc 2)
 *   event: done   {insufficient, nearest_page, cached, usage}
 *   event: error  {code, message}
 *
 * Thứ tự: consent → sở hữu tài liệu → cache → hạn mức → embed truy vấn → search_chunks (RRF)
 * → rerank 20→6 → generate (stream, delta thô chỉ để đo/eval) → verify một lượt (SPEC §6)
 * → ghi messages/verifications/usage_costs/cache.
 */
import { z } from 'npm:zod@3';

import {
  type CitationSource,
  isInsufficient,
  normalizeQuestion,
} from '../_shared/citations.ts';
import { costUsd, embedQuery, generate, generateStream, type Usage } from '../_shared/gemini.ts';
import {
  adminClient,
  corsHeaders,
  errorResponse,
  HttpError,
  requireUser,
  sha256Hex,
  sseHeaders,
  sseStream,
} from '../_shared/http.ts';
import {
  askSystemPrompt,
  askUserPrompt,
  MAX_ANSWER_TOKENS,
  MAX_CONTEXT_CHUNKS,
  type PromptChunk,
  RERANK_CANDIDATES,
  rerankPrompt,
} from '../_shared/prompts.ts';
import {
  MAX_CLAIMS,
  parseScores,
  toVerdict,
  type VerifiedAnswer,
  VERIFY_SYSTEM,
  verifyFromRaw,
  verifyUserPrompt,
} from '../_shared/verify.ts';

const Body = z.object({
  document_id: z.string().uuid(),
  question: z.string().trim().min(2).max(500),
  lang: z.enum(['vi', 'en']),
  // Bỏ qua cache — chỉ eval dùng (vẫn tính hạn mức). Người dùng thường không cần.
  nocache: z.boolean().optional(),
});

const ANSWER_MODEL = Deno.env.get('LLM_MODEL_ANSWER') ?? 'gemini-3.8-flash';
const RERANK_MODEL = Deno.env.get('LLM_MODEL_RERANK') ?? 'gemini-3.5-flash-lite';
const VERIFY_MODEL = Deno.env.get('LLM_MODEL_VERIFY') ?? 'gemini-3.5-flash-lite';
const EMBEDDING_MODEL = Deno.env.get('EMBEDDING_MODEL') ?? 'gemini-embedding-2';
const EMBEDDING_DIM = 768;
const RERANK_ENABLED = (Deno.env.get('RERANK') ?? 'on') !== 'off';

type ChunkRow = { chunk_id: string; page_no: number; text: string; bboxes: unknown; score: number };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = adminClient();
  try {
    const userId = await requireUser(req, admin);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, 'bad_request', 'Thiếu document_id, question hoặc lang.');
    const { document_id, question, lang, nocache } = parsed.data;

    const { data: profile } = await admin
      .from('profiles')
      .select('ai_consent_at, tier')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.ai_consent_at) {
      throw new HttpError(403, 'consent_required', 'Cần đồng ý sử dụng tính năng AI trước.');
    }

    const { data: doc } = await admin
      .from('documents')
      .select('id, status')
      .eq('id', document_id)
      .eq('owner', userId)
      .maybeSingle();
    if (!doc) throw new HttpError(404, 'not_found', 'Không tìm thấy tài liệu.');
    if (doc.status !== 'ready') throw new HttpError(409, 'document_not_ready', 'Tài liệu chưa xử lý xong.');

    const cacheKey = await sha256Hex(`${document_id}|${normalizeQuestion(question)}|${lang}`);
    const { data: cached } = nocache
      ? { data: null }
      : await admin.from('answer_cache').select('answer').eq('key', cacheKey).maybeSingle();

    const sse = sseStream();
    const response = new Response(sse.stream, { headers: sseHeaders });

    // Chạy nền sau khi đã trả header — mọi lỗi từ đây đi qua event `error`.
    (async () => {
      try {
        const conversationId = await ensureConversation(admin, document_id, userId);
        await admin.from('messages').insert({ conversation_id: conversationId, role: 'user', content: question });

        if (cached) {
          const a = cached.answer as {
            text: string;
            citations: Record<string, CitationSource>;
            insufficient: boolean;
            nearest_page: number | null;
            verified: VerifiedAnswer;
          };
          sse.send('meta', { conversation_id: conversationId, citations: a.citations });
          sse.send('delta', { text: a.text });
          sse.send('verified', { answer: a.verified });
          await admin.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: a.text,
            citations: a.citations,
            cost_usd: 0,
          });
          sse.send('done', { insufficient: a.insufficient, nearest_page: a.nearest_page, cached: true, usage: null });
          return;
        }

        // Hạn mức (ADR-0001 chốt chặn 4): đếm ở Postgres, kiểm trước khi gọi model.
        const { data: quota } = await admin.rpc('question_quota', { p_owner: userId }).single();
        const q = quota as { used: number; quota: number; resets_at: string } | null;
        if (q && q.used >= q.quota) {
          sse.send('error', { code: 'quota_exceeded', message: 'Hết lượt hỏi của tháng này.', used: q.used, quota: q.quota, resets_at: q.resets_at });
          return;
        }

        const embedding = await embedQuery(EMBEDDING_MODEL, question, EMBEDDING_DIM);
        const { data: rows, error: searchErr } = await admin.rpc('search_chunks', {
          p_document_id: document_id,
          p_query: question,
          p_embedding: JSON.stringify(embedding),
          p_limit: RERANK_CANDIDATES,
        });
        if (searchErr) throw searchErr;
        let candidates = (rows ?? []) as ChunkRow[];

        let rerankUsage: Usage | null = null;
        if (RERANK_ENABLED && candidates.length > MAX_CONTEXT_CHUNKS) {
          const r = await generate(
            RERANK_MODEL,
            'Bạn là bộ xếp hạng đoạn văn. Chỉ trả JSON.',
            rerankPrompt(question, candidates.map((c) => c.text.slice(0, 700)), MAX_CONTEXT_CHUNKS),
            { json: true, maxTokens: 64 },
          );
          rerankUsage = r.usage;
          const order = parseOrder(r.text, candidates.length);
          if (order.length >= Math.min(MAX_CONTEXT_CHUNKS, candidates.length)) {
            candidates = order.map((i) => candidates[i]!);
          }
        }
        const top = candidates.slice(0, MAX_CONTEXT_CHUNKS);

        const citations: Record<string, CitationSource> = {};
        const promptChunks: PromptChunk[] = top.map((c, i) => {
          const code = `c${i + 1}`;
          citations[code] = { code, chunk_id: c.chunk_id, page_no: c.page_no, bboxes: (c.bboxes as CitationSource['bboxes']) ?? [] };
          return { code, page: c.page_no, text: c.text };
        });
        sse.send('meta', { conversation_id: conversationId, citations });

        const startedAt = Date.now();
        const result = top.length
          ? await generateStream(
              ANSWER_MODEL,
              askSystemPrompt(lang),
              askUserPrompt(question, promptChunks),
              (delta) => sse.send('delta', { text: delta }),
              { maxTokens: MAX_ANSWER_TOKENS },
            )
          : { text: 'INSUFFICIENT', usage: { tokens_in: 0, tokens_out: 0 } };
        if (!top.length) sse.send('delta', { text: result.text });

        const insufficient = isInsufficient(result.text);
        const nearestPage = top[0]?.page_no ?? null;

        // ---- Lớp kiểm chứng (G3): một lời gọi cho mọi mệnh đề, tối đa 12 (ADR-0001) ----
        const chunkTexts: Record<string, string> = {};
        for (const c of top) chunkTexts[c.chunk_id] = c.text;
        let verified: VerifiedAnswer = { paragraphs: [], insufficient: true, nearestPage, omitted: 0 };
        let claimsOut: ReturnType<typeof verifyFromRaw>['claims'] = [];
        let verifyUsage: Usage | null = null;
        let scores: ReturnType<typeof parseScores> = [];
        if (!insufficient) {
          const first = verifyFromRaw(result.text, citations, chunkTexts, [], nearestPage);
          claimsOut = first.claims.slice(0, MAX_CLAIMS);
          if (claimsOut.length) {
            const v = await generate(VERIFY_MODEL, VERIFY_SYSTEM, verifyUserPrompt(claimsOut), {
              json: true,
              maxTokens: 512,
            });
            verifyUsage = v.usage;
            scores = parseScores(v.text);
          }
          verified = verifyFromRaw(result.text, citations, chunkTexts, scores, nearestPage).answer;
        }
        sse.send('verified', { answer: verified });

        const { data: msg } = await admin
          .from('messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: result.text,
            citations,
            verdicts: scores.map((sc) => ({
              claim: claimsOut[sc.i]?.claim ?? '',
              verdict: toVerdict(sc.score),
              score: sc.score,
            })),
            cost_usd: costUsd(ANSWER_MODEL, result.usage),
          })
          .select('id')
          .single();
        // Bảng verifications: theo dõi trôi chất lượng khi đổi model (G3.6).
        if (msg && scores.length) {
          await admin.from('verifications').insert(
            scores.map((sc) => ({
              message_id: msg.id,
              claim: claimsOut[sc.i]?.claim ?? '',
              chunk_id: claimsOut[sc.i]?.citations[0]?.chunk_id ?? null,
              verdict: toVerdict(sc.score),
              score: Math.min(1, Math.max(0, sc.score)),
            })),
          );
        }
        const costRows = [
          { owner: userId, feature: 'answer', model: ANSWER_MODEL, ...result.usage, cost_usd: costUsd(ANSWER_MODEL, result.usage) },
          { owner: userId, feature: 'embed', model: EMBEDDING_MODEL, tokens_in: Math.ceil(question.length / 4), tokens_out: 0, cost_usd: costUsd(EMBEDDING_MODEL, { tokens_in: Math.ceil(question.length / 4), tokens_out: 0 }) },
        ];
        if (rerankUsage) costRows.push({ owner: userId, feature: 'rerank', model: RERANK_MODEL, ...rerankUsage, cost_usd: costUsd(RERANK_MODEL, rerankUsage) });
        if (verifyUsage) costRows.push({ owner: userId, feature: 'verify', model: VERIFY_MODEL, ...verifyUsage, cost_usd: costUsd(VERIFY_MODEL, verifyUsage) });
        await admin.from('usage_costs').insert(costRows);
        await admin.from('answer_cache').upsert({
          key: cacheKey,
          document_id,
          lang,
          answer: { text: result.text, citations, insufficient, nearest_page: nearestPage, model: ANSWER_MODEL, verified },
        });

        sse.send('done', {
          insufficient,
          nearest_page: nearestPage,
          cached: false,
          usage: result.usage,
          latency_ms: Date.now() - startedAt,
        });
      } catch (e) {
        console.error(e);
        const err = e instanceof HttpError ? e : new HttpError(500, 'internal', 'Không trả lời được lúc này.');
        sse.send('error', { code: err.code, message: err.message, ...err.extra });
      } finally {
        sse.close();
      }
    })();

    return response;
  } catch (e) {
    return errorResponse(e);
  }
});

async function ensureConversation(admin: ReturnType<typeof adminClient>, documentId: string, owner: string): Promise<string> {
  const { data: existing } = await admin
    .from('conversations')
    .select('id')
    .eq('document_id', documentId)
    .eq('owner', owner)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin
    .from('conversations')
    .insert({ document_id: documentId, owner })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Đầu ra rerank: mảng chỉ số; lọc trùng và ngoài phạm vi; hỏng thì trả rỗng để giữ thứ tự RRF. */
function parseOrder(text: string, n: number): number[] {
  try {
    const arr = JSON.parse(text) as unknown;
    if (!Array.isArray(arr)) return [];
    const seen = new Set<number>();
    for (const v of arr) {
      const i = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
      if (Number.isInteger(i) && i >= 0 && i < n) seen.add(i);
    }
    return [...seen];
  } catch {
    return [];
  }
}
