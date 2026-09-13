/**
 * Gọi Google Gemini qua REST (không SDK, giữ bề mặt nhỏ trên Deno). Khoá đọc từ secret
 * LLM_PROVIDER_API_KEY — chỉ tồn tại ở Edge Function, không bao giờ ở app (CLAUDE.md quy tắc 1).
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type Usage = { tokens_in: number; tokens_out: number };

/** Giá USD / 1M token (đầu vào, đầu ra) để ghi usage_costs. Cập nhật khi Google đổi giá. */
export const PRICE_PER_M: Record<string, [number, number]> = {
  'gemini-2.5-flash': [0.3, 2.5],
  'gemini-2.5-flash-lite': [0.1, 0.4],
  'gemini-2.5-pro': [1.25, 10],
  'gemini-embedding-001': [0.15, 0],
  // Bản 3.x chọn 2026-09-13; giá lấy theo bậc tương đương 2.5 — đối chiếu bảng giá thật ở G6.
  // 3.8-flash free tier chỉ 20 lời gọi/ngày (đo 2026-09-13) → dùng 3.5-flash cho trả lời.
  'gemini-3.5-flash': [0.3, 2.5],
  'gemini-3.8-flash': [0.3, 2.5],
  'gemini-3.5-flash-lite': [0.1, 0.4],
  'gemini-embedding-2': [0.15, 0],
};

export function costUsd(model: string, usage: Usage): number {
  const [pin, pout] = PRICE_PER_M[model] ?? [0, 0];
  return Number(((usage.tokens_in * pin + usage.tokens_out * pout) / 1_000_000).toFixed(6));
}

function apiKey(): string {
  const key = Deno.env.get('LLM_PROVIDER_API_KEY');
  if (!key) throw new Error('missing_llm_provider_api_key');
  return key;
}

/** Thống kê theo từng request (không dùng biến module: isolate per_worker phục vụ nhiều request). */
export type CallStats = { rate_limit_wait_ms: number };

/** 429 (RPM) thì đợi theo `retryDelay` của Google (tối đa 2 lần, trần 20s); hạn mức ngày thì thua ngay. */
async function post(
  path: string,
  body: unknown,
  stream = false,
  stats?: CallStats,
): Promise<Response> {
  const url = `${BASE}/${path}${stream ? '?alt=sse' : ''}`;
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;
    const text = await res.text().catch(() => '');
    if (res.status === 429 && attempt < 2 && !/PerDay/.test(text)) {
      const m = /"retryDelay":\s*"(\d+)s"/.exec(text);
      const wait = Math.min(20, m ? Number(m[1]) : 5);
      if (stats) stats.rate_limit_wait_ms += wait * 1000;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`gemini_${res.status}: ${text.slice(0, 600)}`);
  }
}

export async function embedQuery(
  model: string,
  text: string,
  dim: number,
  stats?: CallStats,
): Promise<number[]> {
  const res = await post(
    `models/${model}:embedContent`,
    { content: { parts: [{ text }] }, taskType: 'RETRIEVAL_QUERY', outputDimensionality: dim },
    false,
    stats,
  );
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values ?? [];
  if (values.length !== dim) throw new Error(`embedding_dim_mismatch:${values.length}`);
  return values;
}

type GenerateResult = { text: string; usage: Usage };
type Part = { text?: string; thought?: boolean };

/** Ghép văn bản, bỏ part suy nghĩ (`thought: true`) — không bao giờ để lọt ra câu trả lời. */
function textOf(parts: Part[] | undefined): string {
  return (parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
}

function usageOf(json: {
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}): Usage {
  return {
    tokens_in: json.usageMetadata?.promptTokenCount ?? 0,
    tokens_out: json.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/** Một lời gọi không stream; `json: true` ép trả JSON (rerank, verify). */
export async function generate(
  model: string,
  system: string,
  user: string,
  opts: {
    json?: boolean;
    maxTokens?: number;
    temperature?: number;
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
    stats?: CallStats;
  } = {},
): Promise<GenerateResult> {
  const res = await post(
    `models/${model}:generateContent`,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0,
        maxOutputTokens: opts.maxTokens ?? 1024,
        // Model 3.x là model "thinking": phần suy nghĩ ăn vào maxOutputTokens và lộ ra part `thought`.
        // Các việc ở đây (trả lời có ràng buộc, rerank, verify) không cần suy nghĩ dài → 'minimal'
        // (thinkingBudget:0 bị API 3.x từ chối — đo 2026-09-13).
        thinkingConfig: { thinkingLevel: opts.thinkingLevel ?? 'minimal' },
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    },
    false,
    opts.stats,
  );
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: Part[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = textOf(json.candidates?.[0]?.content?.parts);
  return { text, usage: usageOf(json) };
}

/**
 * Stream token; gọi `onDelta` cho từng mẩu văn bản, trả về toàn văn + usage khi xong.
 * Gemini SSE: mỗi `data:` là một JSON GenerateContentResponse với phần text mới.
 */
export async function generateStream(
  model: string,
  system: string,
  user: string,
  onDelta: (text: string) => void | Promise<void>,
  opts: {
    maxTokens?: number;
    temperature?: number;
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
    stats?: CallStats;
  } = {},
): Promise<GenerateResult> {
  const res = await post(
    `models/${model}:streamGenerateContent`,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0,
        maxOutputTokens: opts.maxTokens ?? 1024,
        thinkingConfig: { thinkingLevel: opts.thinkingLevel ?? 'minimal' },
      },
    },
    true,
    opts.stats,
  );
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let usage: Usage = { tokens_in: 0, tokens_out: 0 };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      const json = JSON.parse(payload) as {
        candidates?: { content?: { parts?: Part[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const delta = textOf(json.candidates?.[0]?.content?.parts);
      if (delta) {
        full += delta;
        await onDelta(delta);
      }
      if (json.usageMetadata) usage = usageOf(json);
    }
  }
  return { text: full, usage };
}
