/**
 * G0.7 — chứng minh cách ly dữ liệu giữa hai tài khoản qua đúng con đường app dùng
 * (PostgREST + JWT), không phải SQL nội bộ. Bảng `chunks` là nội dung giáo trình:
 * lộ một dòng là lộ tài liệu của người khác (SPEC §4).
 *
 * Chạy: `pnpm test:rls` (cần `supabase start`). Không có biến môi trường → bỏ qua,
 * để `pnpm test` trên CI không đỏ vì thiếu Postgres.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['SUPABASE_URL'] ?? '';
const anonKey = process.env['SUPABASE_ANON_KEY'] ?? '';
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const configured = Boolean(url && anonKey && serviceKey);

const PASSWORD = 'rls-test-password-1';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function createUser(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

describe.skipIf(!configured)('RLS: user B không đọc được tài liệu của user A', () => {
  // Tạo trong beforeAll: describe.skipIf vẫn chạy thân describe lúc thu thập test.
  let admin: SupabaseClient;
  const stamp = Date.now();
  let idA = '';
  let idB = '';
  let a: SupabaseClient;
  let b: SupabaseClient;
  let anon: SupabaseClient;
  let docA = '';

  beforeAll(async () => {
    admin = createClient(url, serviceKey, noSession);
    idA = await createUser(admin, `rls-a-${stamp}@test.local`);
    idB = await createUser(admin, `rls-b-${stamp}@test.local`);
    a = await signedInClient(`rls-a-${stamp}@test.local`);
    b = await signedInClient(`rls-b-${stamp}@test.local`);
    anon = createClient(url, anonKey, noSession);

    // A tạo một cây dữ liệu đầy đủ: document → page + chunk, conversation → message.
    const doc = await a
      .from('documents')
      .insert({ owner: idA, title: 'Giáo trình của A', sha256: `sha-${stamp}` })
      .select('id')
      .single();
    if (doc.error) throw doc.error;
    docA = doc.data.id as string;

    const page = await a
      .from('pages')
      .insert({ document_id: docA, page_no: 1, image_path: 'p/1.png', width: 1000, height: 1400 });
    if (page.error) throw page.error;

    const chunk = await a.from('chunks').insert({
      document_id: docA,
      page_no: 1,
      ord: 0,
      text: 'định luật bảo toàn năng lượng',
      bboxes: [[0, 0, 10, 10]],
      token_count: 6,
    });
    if (chunk.error) throw chunk.error;

    const conv = await a
      .from('conversations')
      .insert({ document_id: docA, owner: idA })
      .select('id')
      .single();
    if (conv.error) throw conv.error;

    const msg = await a.from('messages').insert({
      conversation_id: conv.data.id as string,
      role: 'user',
      content: 'năng lượng có mất đi không?',
    });
    if (msg.error) throw msg.error;
  });

  afterAll(async () => {
    // Xoá user → cascade xoá toàn bộ dữ liệu test.
    for (const id of [idA, idB]) if (id) await admin.auth.admin.deleteUser(id);
  });

  it('A thấy dữ liệu của chính mình (để chắc test không rỗng)', async () => {
    const docs = await a.from('documents').select('id');
    const chunks = await a.from('chunks').select('id');
    const msgs = await a.from('messages').select('id');
    expect(docs.data).toHaveLength(1);
    expect(chunks.data).toHaveLength(1);
    expect(msgs.data).toHaveLength(1);
  });

  it.each(['documents', 'pages', 'chunks', 'conversations', 'messages'])(
    'B đọc bảng %s: 0 dòng, không lỗi (RLS lọc im lặng)',
    async (table) => {
      const { data, error } = await b.from(table).select('id');
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it('B truy theo id cụ thể của A vẫn không thấy', async () => {
    const { data } = await b.from('documents').select('id').eq('id', docA);
    expect(data).toEqual([]);
  });

  it('B gọi search_chunks trên tài liệu của A: rỗng', async () => {
    const { data, error } = await b.rpc('search_chunks', {
      p_document_id: docA,
      p_query: 'năng lượng',
      p_embedding: JSON.stringify(new Array<number>(768).fill(0)),
      p_limit: 10,
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('B không chèn được tài liệu đứng tên A', async () => {
    const { error } = await b
      .from('documents')
      .insert({ owner: idA, title: 'giả mạo', sha256: `fake-${stamp}` });
    expect(error?.code).toBe('42501'); // vi phạm with check của policy
  });

  it('B không chèn được chunk vào tài liệu của A', async () => {
    const { error } = await b.from('chunks').insert({
      document_id: docA,
      page_no: 1,
      ord: 1,
      text: 'chèn trộm',
      bboxes: [],
      token_count: 2,
    });
    expect(error?.code).toBe('42501');
  });

  it('B sửa/xoá tài liệu của A: 0 dòng bị ảnh hưởng', async () => {
    const upd = await b.from('documents').update({ title: 'đổi trộm' }).eq('id', docA).select('id');
    expect(upd.data).toEqual([]);
    const del = await b.from('documents').delete().eq('id', docA).select('id');
    expect(del.data).toEqual([]);
    const still = await a.from('documents').select('title').eq('id', docA).single();
    expect(still.data?.['title']).toBe('Giáo trình của A');
  });

  it('Storage: B không đọc được ảnh trang của A, A đọc được', async () => {
    // Service role ghi file như services/ingest làm; đường dẫn bắt đầu bằng uuid chủ sở hữu.
    const path = `${idA}/${docA}/pages/1.png`;
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const up = await admin.storage
      .from('documents')
      .upload(path, png, { contentType: 'image/png' });
    expect(up.error).toBeNull();

    const forB = await b.storage.from('documents').download(path);
    expect(forB.data).toBeNull();
    expect(forB.error).not.toBeNull();

    const signedForB = await b.storage.from('documents').createSignedUrl(path, 60);
    expect(signedForB.data).toBeNull();

    const forA = await a.storage.from('documents').download(path);
    expect(forA.error).toBeNull();
    expect(forA.data?.size).toBe(8);
  });

  it('chưa đăng nhập (anon): không thấy gì', async () => {
    const { data } = await anon.from('chunks').select('id');
    expect(data).toEqual([]);
  });
});

describe.skipIf(!configured)('Billing (G6): client không tự nâng tầng; dùng thử một lần', () => {
  let admin: SupabaseClient;
  const stamp = Date.now();
  let idC = '';
  let c: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(url, serviceKey, noSession);
    idC = await createUser(admin, `rls-c-${stamp}@test.local`);
    c = await signedInClient(`rls-c-${stamp}@test.local`);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(idC);
  });

  it('client sửa tier/entitlement bị từ chối; sửa locale thì được', async () => {
    const t = await c.from('profiles').update({ tier: 'pro' }).eq('id', idC);
    expect(t.error).not.toBeNull();
    const e = await c.from('profiles').update({ entitlement: 'lifetime' }).eq('id', idC);
    expect(e.error).not.toBeNull();
    const l = await c.from('profiles').update({ locale: 'en' }).eq('id', idC).select('locale');
    expect(l.error).toBeNull();
    expect(l.data?.[0]?.locale).toBe('en');
    const { data } = await admin
      .from('profiles')
      .select('tier, entitlement')
      .eq('id', idC)
      .single();
    expect(data).toEqual({ tier: 'free', entitlement: 'none' });
  });

  it('start_trial: 21 ngày, pro trong lúc dùng thử, gọi lần hai không gia hạn', async () => {
    const first = await c.rpc('start_trial');
    expect(first.error).toBeNull();
    const ends = new Date(first.data as string).getTime();
    expect(ends - Date.now()).toBeGreaterThan(20 * 86_400_000);
    const ent = await c.rpc('my_entitlement');
    expect(ent.data?.[0]).toMatchObject({ entitlement: 'trial', tier: 'pro' });
    const again = await c.rpc('start_trial');
    expect(new Date(again.data as string).getTime()).toBe(ends);
    // Hết hạn (service role lùi ngày) → tầng hiệu lực về free, cột tier vẫn là bản chiếu cũ.
    await admin
      .from('profiles')
      .update({ trial_ends_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', idC);
    const expired = await c.rpc('my_entitlement');
    expect(expired.data?.[0]?.tier).toBe('free');
    const quota = await c.rpc('my_question_quota');
    expect(quota.data?.[0]).toMatchObject({ tier: 'free', quota: 20 });
  });

  it('cost_dashboard/daily_cost_usd chỉ service role gọi được', async () => {
    const denied = await c.rpc('daily_cost_usd', { p_owner: idC });
    expect(denied.error).not.toBeNull();
    const ok = await admin.rpc('daily_cost_usd', { p_owner: idC });
    expect(ok.error).toBeNull();
    expect(Number(ok.data)).toBe(0);
    const dash = await admin.rpc('cost_dashboard', { p_days: 7 });
    expect(dash.error).toBeNull();
  });
});
