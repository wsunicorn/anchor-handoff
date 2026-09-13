import type { CitationSource } from '@shared/citations';

/**
 * Client SSE cho Edge Function `ask`. Không phụ thuộc React Native — script eval (Node)
 * và app dùng chung. Trả về sự kiện theo thứ tự; người gọi quyết định hiển thị gì
 * (app: chỉ sau verify(); eval: đo trực tiếp).
 */
export type AskMeta = { conversation_id: string; citations: Record<string, CitationSource> };
export type AskDone = {
  insufficient: boolean;
  nearest_page: number | null;
  cached: boolean;
  usage: { tokens_in: number; tokens_out: number } | null;
  latency_ms?: number;
};
export type AskErrorBody = { code: string; message: string; [k: string]: unknown };

export type AskEvent =
  | { type: 'meta'; data: AskMeta }
  | { type: 'delta'; data: { text: string } }
  | { type: 'done'; data: AskDone }
  | { type: 'error'; data: AskErrorBody };

export class AskError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export type AskInput = { document_id: string; question: string; lang: 'vi' | 'en' };

export async function* askStream(
  functionsUrl: string,
  anonKey: string,
  jwt: string,
  input: AskInput,
  signal?: AbortSignal,
): AsyncGenerator<AskEvent> {
  const res = await fetch(`${functionsUrl}/ask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<AskErrorBody>;
    throw new AskError(body.code ?? 'http_error', body.message ?? `HTTP ${res.status}`, body);
  }
  if (!res.body) throw new AskError('no_stream', 'Máy chủ không trả stream.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = parseBlock(block);
      if (event) yield event;
    }
  }
}

function parseBlock(block: string): AskEvent | null {
  let type = '';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!type || !data) return null;
  const parsed = JSON.parse(data) as unknown;
  switch (type) {
    case 'meta':
      return { type, data: parsed as AskMeta };
    case 'delta':
      return { type, data: parsed as { text: string } };
    case 'done':
      return { type, data: parsed as AskDone };
    case 'error':
      return { type, data: parsed as AskErrorBody };
    default:
      return null;
  }
}

/** Gom toàn bộ stream thành một kết quả — dùng cho eval; app dùng generator để hiện dần. */
export async function askOnce(
  functionsUrl: string,
  anonKey: string,
  jwt: string,
  input: AskInput,
): Promise<{ meta: AskMeta | null; text: string; done: AskDone | null; ttft_ms: number | null }> {
  const started = Date.now();
  let meta: AskMeta | null = null;
  let text = '';
  let done: AskDone | null = null;
  let ttft: number | null = null;
  for await (const ev of askStream(functionsUrl, anonKey, jwt, input)) {
    if (ev.type === 'meta') meta = ev.data;
    else if (ev.type === 'delta') {
      if (ttft === null) ttft = Date.now() - started;
      text += ev.data.text;
    } else if (ev.type === 'done') done = ev.data;
    else if (ev.type === 'error') throw new AskError(ev.data.code, ev.data.message, ev.data);
  }
  return { meta, text, done, ttft_ms: ttft };
}
