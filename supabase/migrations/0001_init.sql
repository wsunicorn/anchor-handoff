-- 0001_init.sql — lược đồ khởi tạo, theo docs/SPEC.md §4
-- Quy tắc: một thay đổi một file. Không sửa file này sau khi đã chạy trên môi trường thật.

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------- Người dùng ----------
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  locale      text not null default 'vi',
  tier        text not null default 'free' check (tier in ('free', 'pro')),
  ai_consent_at timestamptz,              -- chưa có giá trị = chưa được gọi LLM
  created_at  timestamptz not null default now()
);

-- ---------- Tài liệu ----------
create table documents (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users on delete cascade,
  title       text not null,
  lang        text,                        -- phát hiện tự động: 'vi' | 'en' | ...
  page_count  int  not null default 0,
  sha256      text not null,
  status      text not null default 'pending'
              check (status in ('pending','parsing','embedding','ready','failed')),
  error       text,
  created_at  timestamptz not null default now(),
  unique (owner, sha256)                   -- cùng người, cùng file: không nạp lại
);

create table pages (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents on delete cascade,
  page_no     int not null,
  image_path  text not null,
  width       int not null,
  height      int not null,
  unique (document_id, page_no)
);

create table chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents on delete cascade,
  page_no     int not null,
  ord         int not null,
  text        text not null,
  bboxes      jsonb not null,              -- [[x0,y0,x1,y1], ...] toạ độ trong hệ của pages
  token_count int not null,
  embedding   vector(768),
  tsv         tsvector generated always as (to_tsvector('simple', text)) stored
);

create index chunks_doc_idx   on chunks (document_id);
create index chunks_tsv_idx   on chunks using gin (tsv);
create index chunks_vec_idx   on chunks using hnsw (embedding vector_cosine_ops);

-- ---------- Hỏi đáp ----------
create table conversations (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents on delete cascade,
  owner       uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  citations       jsonb,                   -- [{chunk_id, page_no, bboxes}]
  verdicts        jsonb,                   -- [{claim, verdict, score}]
  cost_usd        numeric(10,6),
  created_at      timestamptz not null default now()
);

create table verifications (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages on delete cascade,
  claim      text not null,
  chunk_id   uuid references chunks on delete set null,
  verdict    text not null check (verdict in ('grounded','inferred','unsupported')),
  score      numeric(4,3) not null,
  created_at timestamptz not null default now()
);

-- ---------- Ôn tập ----------
create table quizzes (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents on delete cascade,
  scope        jsonb not null,             -- {from_page, to_page} hoặc {chapter}
  generated_at timestamptz not null default now()
);

create table questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references quizzes on delete cascade,
  stem          text not null,
  options       jsonb not null,
  answer_key    text not null,
  explanation   text not null,
  citation      jsonb not null,            -- {chunk_id, page_no, bboxes}
  quality_score numeric(4,3)
);

create table cards (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users on delete cascade,
  question_id uuid not null references questions on delete cascade,
  fsrs_state  jsonb not null,
  due_at      timestamptz not null,
  updated_at  timestamptz not null default now(),
  unique (owner, question_id)
);

create index cards_due_idx on cards (owner, due_at);

-- ---------- Tự luận ----------
create table essays (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users on delete cascade,
  document_id uuid references documents on delete set null,
  body        text not null,
  rubric      jsonb not null,
  feedback    jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- Chi phí ----------
create table usage_costs (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users on delete cascade,
  feature    text not null check (feature in ('embed','answer','verify','quiz','grade','rerank')),
  model      text not null,
  tokens_in  int not null default 0,
  tokens_out int not null default 0,
  cost_usd   numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create index usage_costs_owner_day_idx on usage_costs (owner, created_at);

-- ---------- RLS ----------
-- Để lộ bảng chunks là để lộ toàn bộ giáo trình của người khác. Kiểm kỹ ở G0.7.
alter table profiles      enable row level security;
alter table documents     enable row level security;
alter table pages         enable row level security;
alter table chunks        enable row level security;
alter table conversations enable row level security;
alter table messages      enable row level security;
alter table verifications enable row level security;
alter table quizzes       enable row level security;
alter table questions     enable row level security;
alter table cards         enable row level security;
alter table essays        enable row level security;
alter table usage_costs   enable row level security;

create policy own_profile on profiles
  using (id = auth.uid()) with check (id = auth.uid());

create policy own_documents on documents
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy own_pages on pages using (
  exists (select 1 from documents d where d.id = pages.document_id and d.owner = auth.uid())
);

create policy own_chunks on chunks using (
  exists (select 1 from documents d where d.id = chunks.document_id and d.owner = auth.uid())
);

create policy own_conversations on conversations
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy own_messages on messages using (
  exists (select 1 from conversations c where c.id = messages.conversation_id and c.owner = auth.uid())
);

create policy own_verifications on verifications using (
  exists (
    select 1 from messages m
    join conversations c on c.id = m.conversation_id
    where m.id = verifications.message_id and c.owner = auth.uid()
  )
);

create policy own_quizzes on quizzes using (
  exists (select 1 from documents d where d.id = quizzes.document_id and d.owner = auth.uid())
);

create policy own_questions on questions using (
  exists (
    select 1 from quizzes q join documents d on d.id = q.document_id
    where q.id = questions.quiz_id and d.owner = auth.uid()
  )
);

create policy own_cards on cards
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy own_essays on essays
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy own_usage on usage_costs using (owner = auth.uid());

-- ---------- Truy hồi lai: BM25 + vector, hợp nhất bằng RRF ----------
create or replace function search_chunks(
  p_document_id uuid,
  p_query       text,
  p_embedding   vector(768),
  p_limit       int default 20
)
returns table (chunk_id uuid, page_no int, text text, bboxes jsonb, score numeric)
language sql stable as $$
  with kw as (
    select id, row_number() over (order by ts_rank(tsv, plainto_tsquery('simple', p_query)) desc) as r
    from chunks
    where document_id = p_document_id
      and tsv @@ plainto_tsquery('simple', p_query)
    limit 50
  ),
  vec as (
    select id, row_number() over (order by embedding <=> p_embedding) as r
    from chunks
    where document_id = p_document_id
    limit 50
  ),
  fused as (
    select coalesce(kw.id, vec.id) as id,
           coalesce(1.0 / (60 + kw.r), 0) + coalesce(1.0 / (60 + vec.r), 0) as score
    from kw full outer join vec on kw.id = vec.id
  )
  select c.id, c.page_no, c.text, c.bboxes, f.score::numeric
  from fused f join chunks c on c.id = f.id
  order by f.score desc
  limit p_limit;
$$;
