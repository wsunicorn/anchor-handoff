-- 0002_profiles_on_signup.sql — tự tạo dòng profiles khi có user mới.
-- Không có dòng này thì mọi policy trên profiles vô nghĩa và client không thể tự tạo
-- (insert cần id = auth.uid(), nhưng client chưa có session lúc đăng ký).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, locale)
  values (
    new.id,
    -- Ngôn ngữ giao diện app gửi kèm lúc đăng ký (SPEC §8); thiếu thì mặc định 'vi'.
    coalesce(new.raw_user_meta_data ->> 'locale', 'vi')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
