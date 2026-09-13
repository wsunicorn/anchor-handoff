-- 0004_answer_cache_and_quota.sql — cache câu trả lời (ADR-0001 chốt chặn 2) và hạn mức đếm ở server (chốt chặn 4).

-- ---------- Cache câu trả lời ----------
-- Khoá = sha256(document_id || câu hỏi đã chuẩn hoá || lang). Chỉ Edge Function (service role) đọc/ghi;
-- không bật policy cho client → RLS bật mà không có policy = client không thấy gì.
create table answer_cache (
  key         text primary key,
  document_id uuid not null references documents on delete cascade,
  lang        text not null,
  answer      jsonb not null,               -- {text, citations, insufficient, model}
  created_at  timestamptz not null default now()
);
create index answer_cache_doc_idx on answer_cache (document_id);
alter table answer_cache enable row level security;

-- ---------- Hạn mức câu hỏi theo tháng ----------
-- Đếm từ usage_costs (feature = 'answer'): mỗi lời gọi model thật là một lượt; cache hit không tính.
-- Giới hạn theo ADR-0001 §5: free 20, pro 500.
create or replace function question_quota(p_owner uuid)
returns table (used int, quota int, tier text, resets_at timestamptz)
language sql stable
security definer
set search_path = public
as $$
  with t as (
    select coalesce((select p.tier from profiles p where p.id = p_owner), 'free') as tier
  )
  select
    (select count(*)::int from usage_costs u
      where u.owner = p_owner and u.feature = 'answer'
        and u.created_at >= date_trunc('month', now())) as used,
    case when t.tier = 'pro' then 500 else 20 end as quota,
    t.tier,
    (date_trunc('month', now()) + interval '1 month')::timestamptz as resets_at
  from t;
$$;

-- Bản có tham số chỉ cho service role (Edge Function). Client dùng bản không tham số bên dưới,
-- để không ai đếm được lượt của người khác.
revoke all on function question_quota(uuid) from public;
grant execute on function question_quota(uuid) to service_role;

create or replace function my_question_quota()
returns table (used int, quota int, tier text, resets_at timestamptz)
language sql stable
security definer
set search_path = public
as $$
  select * from question_quota(auth.uid());
$$;
revoke all on function my_question_quota() from public;
grant execute on function my_question_quota() to authenticated;
