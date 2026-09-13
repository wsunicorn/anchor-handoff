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

async function post(path: string, body: unknown, stream = false): Promise<Response> {
  const url = `${BASE}/${path}${stream ? '?alt=sse' : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`gemini_${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

export async function embedQuery(model: string, text: string, dim: number): Promise<number[]> {
  const res = await post(`models/${model}:embedContent`, {
    content: { parts: [{ text }] },
    taskType: 'RETRIEVAL_QUERY',
    outputDimensionality: dim,
  });
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values ?? [];
  if (values.length !== dim) throw new Error(`embedding_dim_mismatch:${values.length}`);
  return values;
}

type GenerateResult = { text: string; usage: Usage };

function usageOf(json: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }): Usage {
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
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {},
): Promise<GenerateResult> {
  const res = await post(`models/${model}:generateContent`, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0,
      maxOutputTokens: opts.maxTokens ?? 1024,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
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
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<GenerateResult> {
  const res = await post(
    `models/${model}:streamGenerateContent`,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: opts.temperature ?? 0, maxOutputTokens: opts.maxTokens ?? 1024 },
    },
    true,
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
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const delta = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (delta) {
        full += delta;
        await onDelta(delta);
      }
      if (json.usageMetadata) usage = usageOf(json);
    }
  }
  return { text: full, usage };
}
