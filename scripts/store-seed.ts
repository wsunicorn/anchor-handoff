/**
 * G7.7 — tài khoản + dữ liệu mẫu cho ảnh/video cửa hàng, tách khỏi user eval (eval giữ tên file kỹ thuật
 * và 500 thẻ seed hiệu năng). Tạo `store@anchor.local` (pro + đã đồng ý AI, đăng nhập bằng mật khẩu để
 * script dùng; trong app đăng nhập bằng OTP qua Mailpit như login.yaml), nạp hai tài liệu với tên hiển thị
 * thật. Cần: stack local + uvicorn + quota nhúng Gemini (~150 nội dung).
 *   bash scripts/store-seed.sh
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EMAIL = 'store@anchor.local';
const PASSWORD = 'store-pass-anchor-1';
/** Tên hiển thị = tiêu đề thật của tài liệu mẫu (docs/samples). Cùng tên dùng trong .maestro/store/{vi,en}.yaml. */
const DOCS: { file: string; title: string }[] = [
  { file: 'en_attention.pdf', title: 'Attention Is All You Need' },
  { file: 'vi_decuong_ctu.pdf', title: 'Đề cương Vật lý đại cương' },
];

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu ${name}`);
  return v;
}

async function main(): Promise<void> {
  const url = env('SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const ingest = process.env.INGEST_URL ?? 'http://127.0.0.1:8000';
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  let userId = created.user?.id;
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list.users.find((u) => u.email === EMAIL)?.id;
  }
  if (!userId) throw new Error('không tạo được user store');
  await admin
    .from('profiles')
    .update({ entitlement: 'pro', ai_consent_at: new Date().toISOString() })
    .eq('id', userId);

  const user = createClient(url, anon, { auth: { persistSession: false } });
  const { data: session, error } = await user.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !session.session) throw error ?? new Error('đăng nhập store thất bại');
  const jwt = session.session.access_token;
  const client = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  for (const doc of DOCS) {
    const { data: existing } = await client
      .from('documents')
      .select('id,status')
      .eq('title', doc.title)
      .maybeSingle();
    if (existing?.status === 'ready') {
      console.log(`✓ ${doc.title} (đã có)`);
      continue;
    }
    const path = join(ROOT, 'docs', 'samples', doc.file);
    if (!existsSync(path)) throw new Error(`Thiếu ${path} — chạy bash docs/samples/fetch.sh`);
    const res = await fetch(`${ingest}/documents?title=${encodeURIComponent(doc.title)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/pdf' },
      body: readFileSync(path),
    });
    const body = (await res.json()) as { document_id?: string; code?: string; message?: string };
    if (!res.ok || !body.document_id) throw new Error(`ingest ${doc.file}: ${body.code} ${body.message}`);
    process.stdout.write(`… ${doc.title}`);
    for (let i = 0; i < 300; i += 1) {
      const { data } = await client
        .from('documents')
        .select('status,error')
        .eq('id', body.document_id)
        .single();
      if (data?.status === 'ready') break;
      if (data?.status === 'failed') throw new Error(`\ningest ${doc.file} failed: ${data.error}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.log(' ready');
  }
  console.log(`seed xong: ${EMAIL} — đăng nhập trong app bằng OTP (Mailpit), rồi bash scripts/store-shots.sh vi|en`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
