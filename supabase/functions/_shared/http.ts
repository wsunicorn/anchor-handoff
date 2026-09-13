import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Lỗi trả dạng `{code, message}` (CLAUDE.md quy ước Edge Function). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function errorResponse(e: unknown): Response {
  const err = e instanceof HttpError ? e : new HttpError(500, 'internal', 'Lỗi máy chủ.');
  if (!(e instanceof HttpError)) console.error(e);
  return new Response(JSON.stringify({ code: err.code, message: err.message, ...err.extra }), {
    status: err.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Client service role — bỏ qua RLS, chỉ dùng sau khi đã xác minh người dùng. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Xác minh JWT của người dùng qua GoTrue; trả về user id. */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<string> {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError(401, 'unauthorized', 'Thiếu token đăng nhập.');
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, 'unauthorized', 'Token không hợp lệ hoặc đã hết hạn.');
  return data.user.id;
}

/** Ghi SSE: `event: <name>\ndata: <json>\n\n`. */
export function sseStream(): {
  stream: ReadableStream<Uint8Array>;
  send: (event: string, data: unknown) => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    stream,
    send: (event, data) =>
      controller?.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)),
    close: () => controller?.close(),
  };
}

export const sseHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
