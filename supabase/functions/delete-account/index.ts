/**
 * Edge Function `delete-account` (G7.6, SPEC §3.4 "xoá tài khoản là xoá thật"): người dùng tự xoá từ app.
 * Xoá file trong Storage (`documents/<uid>/…`) rồi xoá auth.users — mọi bảng tham chiếu cascade
 * (profiles, documents → pages/chunks, conversations → messages, cards, essays, usage_costs).
 * Bản sao lưu của Supabase giữ tối đa 30 ngày (SPEC), không có nút khôi phục.
 */
import { adminClient, corsHeaders, errorResponse, requireUser } from '../_shared/http.ts';

const BUCKET = 'documents';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = adminClient();
  try {
    const userId = await requireUser(req, admin);

    // Storage không cascade theo DB — liệt kê và xoá theo lô.
    let removed = 0;
    const stack = [userId];
    while (stack.length) {
      const prefix = stack.pop()!;
      const { data: entries } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
      const files = (entries ?? []).filter((e) => e.id).map((e) => `${prefix}/${e.name}`);
      const dirs = (entries ?? []).filter((e) => !e.id).map((e) => `${prefix}/${e.name}`);
      stack.push(...dirs);
      for (let i = 0; i < files.length; i += 200) {
        const batch = files.slice(i, i + 200);
        const { error } = await admin.storage.from(BUCKET).remove(batch);
        if (error) throw error;
        removed += batch.length;
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, files_removed: removed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return errorResponse(e);
  }
});
