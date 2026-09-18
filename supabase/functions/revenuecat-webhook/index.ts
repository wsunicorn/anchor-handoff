/**
 * Webhook RevenueCat (G6.1/G6.7): nguồn sự thật duy nhất cho gói trả tiền. App KHÔNG tự đặt tier
 * (client đã bị revoke update cột entitlement — 0005_billing). RevenueCat gọi vào đây với header
 * `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`; `app_user_id` = uuid người dùng Supabase
 * (app đăng nhập RevenueCat bằng chính id đó).
 *
 * Ánh xạ sự kiện → entitlement:
 *   INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / PRODUCT_CHANGE / NON_RENEWING_PURCHASE (lifetime) → pro | lifetime
 *   EXPIRATION / BILLING_ISSUE (hết hạn) → none  (CANCELLATION chỉ là tắt tự gia hạn — giữ tới EXPIRATION)
 *   Sự kiện khác (TEST, TRANSFER, SUBSCRIBER_ALIAS…) → 200, không đổi gì.
 */
import { z } from 'npm:zod@3';

import { adminClient, corsHeaders, errorResponse, HttpError } from '../_shared/http.ts';

const Event = z.object({
  api_version: z.string().optional(),
  event: z.object({
    type: z.string(),
    app_user_id: z.string(),
    product_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).nullable().optional(),
    expiration_at_ms: z.number().nullable().optional(),
    period_type: z.string().optional(), // NORMAL | TRIAL | INTRO
  }),
});

const GRANT = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
]);
const REVOKE = new Set(['EXPIRATION']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = adminClient();
  try {
    const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (!secret) throw new HttpError(500, 'not_configured', 'Thiếu REVENUECAT_WEBHOOK_SECRET.');
    const auth = req.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${secret}`) throw new HttpError(401, 'unauthorized', 'Sai secret.');

    const parsed = Event.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(400, 'bad_request', 'Sự kiện không đúng dạng.');
    const ev = parsed.data.event;
    const isUuid = /^[0-9a-f-]{36}$/i.test(ev.app_user_id);
    if (!isUuid) return json({ ok: true, ignored: 'app_user_id không phải uuid Supabase' });

    let entitlement: 'pro' | 'lifetime' | 'none' | null = null;
    if (GRANT.has(ev.type)) {
      entitlement = /lifetime/i.test(ev.product_id ?? '') ? 'lifetime' : 'pro';
    } else if (REVOKE.has(ev.type)) {
      entitlement = 'none';
    }
    if (!entitlement) return json({ ok: true, ignored: ev.type });

    const { error } = await admin.from('profiles').update({ entitlement }).eq('id', ev.app_user_id);
    if (error) throw error;
    return json({ ok: true, entitlement });
  } catch (e) {
    return errorResponse(e);
  }
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
