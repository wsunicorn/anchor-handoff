-- 0005_billing.sql — G6: quyền lợi (entitlement), dùng thử 21 ngày, tầng hiệu lực, chi phí ngày, dashboard.
--
-- Quyết định (2026-09-18, ADR-0001 §5 "paywall cứng + dùng thử dài"): dùng thử tính ở server, không cần thẻ
-- — `start_trial()` một lần cho mỗi tài khoản. Gói trả tiền do RevenueCat báo qua webhook
-- (Edge Function `revenuecat-webhook`, service role). Client KHÔNG được tự sửa tier/entitlement.

alter table profiles
  add column entitlement text not null default 'none'
    check (entitlement in ('none', 'trial', 'pro', 'lifetime')),
  add column trial_ends_at timestamptz,
  add column entitlement_updated_at timestamptz;

-- Trước đây policy own_profile cho client UPDATE mọi cột (kể cả tier). Khoá lại theo cột.
revoke update on profiles from authenticated;
grant update (locale, ai_consent_at) on profiles to authenticated;

create index usage_costs_owner_created_idx on usage_costs (owner, created_at desc);

-- Tầng hiệu lực: pro/lifetime → pro; trial còn hạn → pro; còn lại free. Mọi nơi kiểm hạn mức dùng hàm này,
-- không đọc cột `tier` (cột chỉ còn là bản chiếu để tương thích; trigger dưới giữ đồng bộ).
create or replace function effective_tier(p_owner uuid)
returns text
language sql stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when p.entitlement in ('pro', 'lifetime') then 'pro'
      when p.entitlement = 'trial' and p.trial_ends_at > now() then 'pro'
      else 'free'
    end
    from profiles p where p.id = p_owner
  ), 'free');
$$;
-- Supabase đặt default privileges cấp EXECUTE cho anon/authenticated → phải revoke đích danh, "public" chưa đủ.
revoke all on function effective_tier(uuid) from public, anon, authenticated;
grant execute on function effective_tier(uuid) to service_role;
-- question_quota (0004) cũng chỉ revoke "public" — khoá lại đúng cách.
revoke all on function question_quota(uuid) from public, anon, authenticated;

create or replace function my_entitlement()
returns table (entitlement text, trial_ends_at timestamptz, tier text)
language sql stable
security definer
set search_path = public
as $$
  select p.entitlement, p.trial_ends_at, effective_tier(auth.uid())
  from profiles p where p.id = auth.uid();
$$;
revoke all on function my_entitlement() from public;
grant execute on function my_entitlement() to authenticated;

-- Giữ cột `tier` khớp entitlement (trial hết hạn được xử lý bởi effective_tier, không cần cron).
create or replace function sync_tier_from_entitlement()
returns trigger
language plpgsql
as $$
begin
  new.tier := case when new.entitlement in ('pro', 'lifetime', 'trial') then 'pro' else 'free' end;
  new.entitlement_updated_at := now();
  return new;
end;
$$;
create trigger profiles_sync_tier
  before update of entitlement on profiles
  for each row execute function sync_tier_from_entitlement();

-- Dùng thử 21 ngày, một lần duy nhất; trả về ngày hết hạn. Đã từng dùng thử/đã trả tiền → không đổi gì.
create or replace function start_trial()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ends timestamptz;
begin
  update profiles
    set entitlement = 'trial', trial_ends_at = now() + interval '21 days'
    where id = auth.uid() and entitlement = 'none' and trial_ends_at is null
    returning trial_ends_at into ends;
  if ends is null then
    select trial_ends_at into ends from profiles where id = auth.uid();
  end if;
  return ends;
end;
$$;
revoke all on function start_trial() from public;
grant execute on function start_trial() to authenticated;

-- question_quota: đếm theo tầng hiệu lực thay vì cột tier.
create or replace function question_quota(p_owner uuid)
returns table (used int, quota int, tier text, resets_at timestamptz)
language sql stable
security definer
set search_path = public
as $$
  with t as (select effective_tier(p_owner) as tier)
  select
    (select count(*)::int from usage_costs u
      where u.owner = p_owner and u.feature = 'answer'
        and u.created_at >= date_trunc('month', now())) as used,
    case when t.tier = 'pro' then 500 else 20 end as quota,
    t.tier,
    (date_trunc('month', now()) + interval '1 month')::timestamptz as resets_at
  from t;
$$;

-- Ngắt mạch (ADR-0001 chốt chặn 6): tổng chi phí hôm nay của một người (UTC ngày).
create or replace function daily_cost_usd(p_owner uuid)
returns numeric
language sql stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_usd), 0) from usage_costs
  where owner = p_owner and created_at >= date_trunc('day', now());
$$;
revoke all on function daily_cost_usd(uuid) from public, anon, authenticated;
grant execute on function daily_cost_usd(uuid) to service_role;

-- Dashboard nội bộ (G6.5): theo tầng hiệu lực trong N ngày gần nhất — người dùng hoạt động (có lời gọi),
-- chi phí, chi phí / người hoạt động. Doanh thu và biên tính ở script (giá gói nằm ngoài DB).
create or replace function cost_dashboard(p_days int default 7)
returns table (
  tier text,
  active_users int,
  calls int,
  cost_usd numeric,
  cost_per_active_user numeric,
  by_feature jsonb
)
language sql stable
security definer
set search_path = public
as $$
  with u as (
    select effective_tier(owner) as tier, owner, feature, cost_usd
    from usage_costs
    where created_at >= now() - make_interval(days => p_days)
  )
  select
    tier,
    count(distinct owner)::int as active_users,
    count(*)::int as calls,
    round(sum(cost_usd), 4) as cost_usd,
    round(sum(cost_usd) / greatest(count(distinct owner), 1), 4) as cost_per_active_user,
    (select jsonb_object_agg(feature, c) from (
       select feature, round(sum(cost_usd), 4) as c from u u2 where u2.tier = u.tier group by feature
     ) f) as by_feature
  from u
  group by tier;
$$;
revoke all on function cost_dashboard(int) from public, anon, authenticated;
grant execute on function cost_dashboard(int) to service_role;
