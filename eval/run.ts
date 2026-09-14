/**
 * eval/run.ts — cổng chất lượng RAG (G2.10, SPEC §7).
 *
 *   pnpm eval:rag            chạy 100 câu, in bảng, ghi eval/out/<thời điểm>.json
 *   pnpm eval:gate           như trên, exit 1 nếu vi phạm ngưỡng (CI)
 *   pnpm eval:seed           chỉ tạo user eval + nạp 6 tài liệu (cho test Maestro), không hỏi
 *   pnpm eval:diff           so hai lần chạy gần nhất, in câu nào tệ đi
 *   EVAL_ONLY=vi-001,en-003  chỉ chạy vài câu;  EVAL_LABEL=rerank-off  gắn nhãn cho lần chạy
 *   EVAL_PACE_MS=10000       tối thiểu ms giữa hai câu (free tier 15 RPM); mặc định 0
 *
 * Cần: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, INGEST_URL (scripts/eval.sh nạp từ
 * Supabase local). Tài liệu lấy ở docs/samples (bash docs/samples/fetch.sh).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { AskError, askOnce } from '../src/lib/askClient';
import { parseAnswer } from '../supabase/functions/_shared/citations';

type Golden = {
  id: string;
  lang: 'vi' | 'en';
  doc: string;
  question: string;
  answerable: boolean;
  expected_pages: number[];
  expected_gist: string;
  must_not_say: string[];
};

type ItemResult = {
  id: string;
  lang: string;
  answerable: boolean;
  ok: boolean; // chạy được, không lỗi hệ thống
  error?: string;
  insufficient: boolean;
  retrieved_pages: number[];
  recall_hit: boolean | null;
  citation: { pass: number; fail: number; ambiguous: string[] } | null; // trên câu đã kiểm chứng (UI thấy)
  citation_raw: { pass: number; fail: number; ambiguous: string[] } | null; // trên văn bản thô (chẩn đoán)
  omitted: number;
  must_not_say_hit: string[];
  gist_hit: boolean | null;
  ttft_ms: number | null;
  latency_ms: number | null;
  timing?: Record<string, number>;
  answer: string;
};

const THRESHOLDS = {
  recall_at_6: 0.85,
  citation_precision: 0.9,
  unsupported_leak: 0.03,
  refusal_accuracy: 0.8,
  ttft_p95_ms: 2500,
};

const env = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Thiếu biến môi trường ${k}`);
  return v;
};

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'eval', 'out');
const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'are',
  'was',
  'were',
  'của',
  'và',
  'các',
  'là',
  'cho',
  'trong',
  'được',
  'với',
  'một',
  'có',
  'không',
  'theo',
  'từ',
  'về',
  'đến',
  'những',
  'này',
  'đó',
]);

function tokens(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function overlap(a: string, b: string): number {
  const ta = tokens(a);
  if (!ta.length) return 1;
  const tb = new Set(tokens(b));
  return ta.filter((w) => tb.has(w)).length / ta.length;
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'rag';
  if (mode === 'diff') return diff();

  const url = env('SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const ingest = process.env.INGEST_URL ?? 'http://127.0.0.1:8000';
  const functionsUrl = `${url}/functions/v1`;
  const admin = createClient(url, service, { auth: { persistSession: false } });

  // 1. Người dùng eval: cố định email, pro + consent, đăng nhập bằng mật khẩu.
  const email = 'eval@anchor.local';
  const password = 'eval-pass-anchor-1';
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  let userId = created.user?.id;
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list.users.find((u) => u.email === email)?.id;
  }
  if (!userId) throw new Error('không tạo được user eval');
  await admin
    .from('profiles')
    .update({ tier: 'pro', ai_consent_at: new Date().toISOString() })
    .eq('id', userId);
  const user = createClient(url, anon, { auth: { persistSession: false } });
  const { data: session, error: signErr } = await user.auth.signInWithPassword({ email, password });
  if (signErr || !session.session) throw signErr ?? new Error('đăng nhập eval thất bại');
  const jwt = session.session.access_token;

  // 2. Bộ vàng + tài liệu.
  const golden: Golden[] = readFileSync(join(ROOT, 'eval', 'golden.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l: string) => JSON.parse(l) as Golden);
  const only = process.env.EVAL_ONLY?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // EVAL_ONLY rỗng (CI push không có input) = chạy tất cả.
  const items = only?.length ? golden.filter((g) => only.includes(g.id)) : golden;

  const docIds = new Map<string, string>();
  for (const doc of new Set(items.map((g) => g.doc))) {
    docIds.set(doc, await ensureDocument(ingest, url, anon, jwt, userId, doc));
  }
  if (mode === 'seed') {
    console.log(`seed xong: ${email}, ${docIds.size} tài liệu ready`);
    return;
  }

  // 3. Hỏi từng câu. EVAL_RESUME=<file json>: giữ kết quả đã chạy được, chỉ hỏi lại câu lỗi.
  const results: ItemResult[] = [];
  const resumeFrom = process.env.EVAL_RESUME
    ? (JSON.parse(readFileSync(process.env.EVAL_RESUME, 'utf8')) as { results: ItemResult[] })
        .results
    : [];
  const reusable = new Map(resumeFrom.filter((r) => r.ok).map((r) => [r.id, r]));
  for (const g of items) {
    const prev = reusable.get(g.id);
    if (prev) {
      results.push(prev);
      continue;
    }
    const documentId = docIds.get(g.doc)!;
    const started = Date.now();
    try {
      const r = await askOnce(functionsUrl, anon, jwt, {
        document_id: documentId,
        question: g.question,
        lang: g.lang,
        nocache: true,
      });
      const citations = r.meta?.citations ?? {};
      const retrievedPages = [...new Set(Object.values(citations).map((c) => c.page_no))].sort(
        (a, b) => a - b,
      );
      const insufficient = r.done?.insufficient ?? false;

      const grade = (
        sentences: { text: string; citations: { chunk_id: string }[]; uncited?: boolean }[],
        chunkTexts: Map<string, string>,
      ) => {
        const g = { pass: 0, fail: 0, ambiguous: [] as string[] };
        for (const s of sentences) {
          if (!s.citations.length) {
            if (s.uncited) g.fail += 1;
            continue;
          }
          const joined = s.citations.map((c) => chunkTexts.get(c.chunk_id) ?? '').join(' ');
          const score = overlap(s.text, joined);
          // So số theo dạng chỉ-chữ-số: "37,000" ↔ "37000", "4.000" ↔ "4000".
          const digits = (t: string) =>
            (t.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]/g, ''));
          const joinedDigits = new Set(digits(joined));
          const numbersOk = digits(s.text).every((n) => joinedDigits.has(n) || joined.includes(n));
          if (score >= 0.5 && numbersOk) g.pass += 1;
          else if (score >= 0.3) g.ambiguous.push(s.text);
          else g.fail += 1;
        }
        return g;
      };

      let citation: ItemResult['citation'] = null;
      let citationRaw: ItemResult['citation_raw'] = null;
      const verifiedInsufficient = r.verified?.insufficient ?? insufficient;
      if (g.answerable && !insufficient) {
        const chunkTexts = await chunkTextsFor(
          user,
          Object.values(citations).map((c) => c.chunk_id),
        );
        citationRaw = grade(
          parseAnswer(r.text, citations).flatMap((p) => p.sentences),
          chunkTexts,
        );
        citation = grade(
          (r.verified?.paragraphs ?? []).flatMap((p) =>
            p.sentences.filter((x) => x.citations.length),
          ),
          chunkTexts,
        );
      }

      const answerLower = r.text.toLowerCase();
      results.push({
        id: g.id,
        lang: g.lang,
        answerable: g.answerable,
        ok: true,
        insufficient: verifiedInsufficient,
        retrieved_pages: retrievedPages,
        recall_hit: g.answerable ? g.expected_pages.some((p) => retrievedPages.includes(p)) : null,
        citation,
        citation_raw: citationRaw,
        omitted: r.verified?.omitted ?? 0,
        must_not_say_hit: g.must_not_say.filter((s) => answerLower.includes(s.toLowerCase())),
        gist_hit: g.answerable && !insufficient ? overlap(g.expected_gist, r.text) >= 0.5 : null,
        ttft_ms: r.ttft_ms,
        latency_ms: Date.now() - started,
        timing: r.done?.timing,
        answer: r.text,
      });
      process.stdout.write(
        `${g.id} ${insufficient ? 'INSUFFICIENT' : 'ok'} pages=${retrievedPages.join(',')}\n`,
      );
    } catch (e) {
      const msg = e instanceof AskError ? `${e.code}: ${e.message}` : String(e);
      results.push({
        id: g.id,
        lang: g.lang,
        answerable: g.answerable,
        ok: false,
        error: msg,
        insufficient: false,
        retrieved_pages: [],
        recall_hit: null,
        citation: null,
        citation_raw: null,
        omitted: 0,
        must_not_say_hit: [],
        gist_hit: null,
        ttft_ms: null,
        latency_ms: null,
        answer: '',
      });
      process.stdout.write(`${g.id} LỖI ${msg}\n`);
      if (e instanceof AskError && e.code === 'quota_exceeded') break;
    }
    // Giãn nhịp giữa hai câu: free tier Gemini 15 lời gọi/phút/model, mỗi câu 2 lời gọi (trả lời + verify).
    // Tính từ lúc bắt đầu câu để thời gian trả lời không cộng dồn vào nhịp.
    const pace = Number(process.env.EVAL_PACE_MS ?? 0);
    const rest = pace - (Date.now() - started);
    if (rest > 0) await new Promise((r) => setTimeout(r, rest));
  }

  // 4. Chỉ số.
  const answerable = results.filter((r) => r.ok && r.answerable);
  const traps = results.filter((r) => r.ok && !r.answerable);
  const recall = ratio(answerable.filter((r) => r.recall_hit).length, answerable.length);
  const cit = answerable.filter((r) => r.citation);
  const pass = cit.reduce((n, r) => n + r.citation!.pass, 0);
  const fail = cit.reduce((n, r) => n + r.citation!.fail, 0);
  const ambiguous = cit.reduce((n, r) => n + r.citation!.ambiguous.length, 0);
  const citationPrecision = ratio(pass, pass + fail);
  const rawPass = cit.reduce((n, r) => n + (r.citation_raw?.pass ?? 0), 0);
  const rawFail = cit.reduce((n, r) => n + (r.citation_raw?.fail ?? 0), 0);
  const citationPrecisionRaw = ratio(rawPass, rawPass + rawFail);
  // Câu đã qua verify mà so khớp vẫn thất bại = mệnh đề không căn cứ lọt ra UI.
  const unsupportedLeak = ratio(fail, pass + fail);
  const omittedTotal = answerable.reduce((n, r) => n + r.omitted, 0);
  const refusal = ratio(traps.filter((r) => r.insufficient).length, traps.length);
  const falseRefusal = ratio(answerable.filter((r) => r.insufficient).length, answerable.length);
  const leaks = traps.filter((r) => r.must_not_say_hit.length).length;
  // TTFT: bỏ câu mà nhà cung cấp trả 429 trước token đầu (hạn mức free tier, không phải pipeline).
  // Số câu bị bỏ in ra và ghi vào summary để không giấu.
  const rateLimited = results.filter((r) => (r.timing?.rate_limit_wait_ms ?? 0) > 0).length;
  const ttfts = results
    .filter((r) => !(r.timing?.rate_limit_wait_ms ?? 0))
    .map((r) => r.ttft_ms)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const p95 = ttfts.length
    ? ttfts[Math.min(ttfts.length - 1, Math.floor(ttfts.length * 0.95))]!
    : null;
  const gist = ratio(
    answerable.filter((r) => r.gist_hit).length,
    answerable.filter((r) => r.gist_hit !== null).length,
  );

  const summary = {
    label: process.env.EVAL_LABEL ?? '',
    at: new Date().toISOString(),
    n: results.length,
    errors: results.filter((r) => !r.ok).length,
    recall_at_6: recall,
    citation_precision: citationPrecision,
    citation_precision_raw: citationPrecisionRaw,
    citation_ambiguous: ambiguous,
    unsupported_leak: unsupportedLeak,
    omitted_total: omittedTotal,
    refusal_accuracy: refusal,
    false_refusal: falseRefusal,
    must_not_say_leaks: leaks,
    gist_hit: gist,
    ttft_p95_ms: p95,
    ttft_n: ttfts.length,
    ttft_excluded_429: rateLimited,
    thresholds: THRESHOLDS,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(
    OUT_DIR,
    `${summary.at.replace(/[:.]/g, '-')}${summary.label ? `_${summary.label}` : ''}.json`,
  );
  writeFileSync(file, JSON.stringify({ summary, results }, null, 2));

  const row = (k: string, v: string | number | null, t?: number, lowerIsBetter = false) => {
    const okMark =
      t === undefined || v === null
        ? ''
        : (lowerIsBetter ? (v as number) <= t : (v as number) >= t)
          ? '  ✓'
          : '  ✗';
    console.log(
      `${k.padEnd(22)} ${String(v ?? '-').padStart(8)}${t !== undefined ? `  (ngưỡng ${lowerIsBetter ? '≤' : '≥'} ${t})` : ''}${okMark}`,
    );
  };
  console.log('\n=== Kết quả eval ===');
  row('câu chạy / lỗi', `${summary.n} / ${summary.errors}`);
  row('recall@6', fmt(recall), THRESHOLDS.recall_at_6);
  row('citation_precision', fmt(citationPrecision), THRESHOLDS.citation_precision);
  row('  (thô, trước verify)', fmt(citationPrecisionRaw));
  row('  câu mập mờ (chấm tay)', ambiguous);
  row('unsupported_leak', fmt(unsupportedLeak), THRESHOLDS.unsupported_leak, true);
  row('  mệnh đề đã ẩn', omittedTotal);
  row('refusal_accuracy', fmt(refusal), THRESHOLDS.refusal_accuracy);
  row('false_refusal', fmt(falseRefusal));
  row('must_not_say leaks', leaks);
  row('gist_hit (tham khảo)', fmt(gist));
  row('ttft_p95_ms', p95, THRESHOLDS.ttft_p95_ms, true);
  row('  n / bỏ vì 429', `${ttfts.length} / ${rateLimited}`);
  console.log(`\nGhi: ${file}`);
  if (ambiguous) {
    console.log('\nCâu cần chấm tay (citation mập mờ):');
    for (const r of cit) for (const s of r.citation!.ambiguous) console.log(`  [${r.id}] ${s}`);
  }

  if (mode === 'gate') {
    const bad: string[] = [];
    if (summary.errors) bad.push(`lỗi hệ thống: ${summary.errors}`);
    if (recall === null || recall < THRESHOLDS.recall_at_6) bad.push('recall@6');
    if (citationPrecision === null || citationPrecision < THRESHOLDS.citation_precision)
      bad.push('citation_precision');
    if (unsupportedLeak !== null && unsupportedLeak > THRESHOLDS.unsupported_leak)
      bad.push('unsupported_leak');
    if (refusal === null || refusal < THRESHOLDS.refusal_accuracy) bad.push('refusal_accuracy');
    if (p95 === null || p95 > THRESHOLDS.ttft_p95_ms) bad.push('ttft_p95');
    if (bad.length) {
      console.error(`\nGATE FAIL: ${bad.join(', ')}`);
      process.exit(1);
    }
    console.log('\nGATE PASS');
  }
}

function ratio(a: number, b: number): number | null {
  return b === 0 ? null : Number((a / b).toFixed(3));
}
function fmt(v: number | null): string | null {
  return v === null ? null : v.toFixed(3);
}

async function ensureDocument(
  ingest: string,
  url: string,
  anon: string,
  jwt: string,
  userId: string,
  doc: string,
): Promise<string> {
  const title = basename(doc, '.pdf');
  const client = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: existing } = await client
    .from('documents')
    .select('id,status')
    .eq('owner', userId)
    .eq('title', title)
    .maybeSingle();
  if (existing?.status === 'ready') return existing.id;
  const path = join(ROOT, 'docs', 'samples', doc);
  if (!existsSync(path)) throw new Error(`Thiếu ${path} — chạy bash docs/samples/fetch.sh`);
  const res = await fetch(`${ingest}/documents?title=${encodeURIComponent(title)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/pdf' },
    body: readFileSync(path),
  });
  const body = (await res.json()) as { document_id?: string; code?: string; message?: string };
  if (!res.ok || !body.document_id) throw new Error(`ingest ${doc}: ${body.code} ${body.message}`);
  for (let i = 0; i < 120; i += 1) {
    const { data } = await client
      .from('documents')
      .select('status,error')
      .eq('id', body.document_id)
      .single();
    if (data?.status === 'ready') return body.document_id;
    if (data?.status === 'failed') throw new Error(`ingest ${doc} failed: ${data.error}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`ingest ${doc} quá thời gian`);
}

async function chunkTextsFor(client: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data } = await client.from('chunks').select('id,text').in('id', ids);
  for (const row of data ?? []) out.set(row.id as string, row.text as string);
  return out;
}

function diff(): void {
  const files = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length < 2) {
    console.log('Cần ít nhất hai lần chạy trong eval/out.');
    return;
  }
  const [prev, cur] = files.slice(-2).map(
    (f) =>
      JSON.parse(readFileSync(join(OUT_DIR, f), 'utf8')) as {
        summary: Record<string, unknown>;
        results: ItemResult[];
      },
  );
  console.log(`So sánh ${files.at(-2)} → ${files.at(-1)}`);
  for (const k of [
    'recall_at_6',
    'citation_precision',
    'unsupported_leak',
    'refusal_accuracy',
    'ttft_p95_ms',
  ]) {
    console.log(`${k.padEnd(20)} ${String(prev!.summary[k])} → ${String(cur!.summary[k])}`);
  }
  const before = new Map(prev!.results.map((r) => [r.id, r]));
  for (const r of cur!.results) {
    const b = before.get(r.id);
    if (!b) continue;
    const worse =
      (b.recall_hit && !r.recall_hit) ||
      (!b.answerable && b.insufficient && !r.insufficient) ||
      (b.answerable && !b.insufficient && r.insufficient);
    if (worse)
      console.log(
        `  tệ đi: ${r.id} (${r.insufficient ? 'INSUFFICIENT' : `pages ${r.retrieved_pages.join(',')}`})`,
      );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
