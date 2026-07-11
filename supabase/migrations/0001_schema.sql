-- Recruitix core schema: auth profiles, face embeddings, companies/question bank,
-- exam sessions/responses, face-gate attempts, proctoring violations, live user activity.
-- See C:\Users\DEBRAJ\.claude\plans\delegated-watching-candy.md for design rationale.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ===================== profiles =====================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  date_of_birth date,
  role text not null default 'candidate' check (role in ('candidate','recruiter')),
  face_enrolled boolean not null default false,
  enrollment_status text not null default 'pending' check (enrollment_status in ('pending','in_progress','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_recruiter() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'recruiter');
$$;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_select_recruiter" on public.profiles for select using (public.is_recruiter());

-- signup form (name, DOB) arrives via auth.users.raw_user_meta_data, trigger copies it in
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, date_of_birth, role)
  values (
    new.id, new.email,
    new.raw_user_meta_data->>'display_name',
    nullif(new.raw_user_meta_data->>'date_of_birth','')::date,
    coalesce(new.raw_user_meta_data->>'role', 'candidate')
  );
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ===================== face_embeddings (enrollment template) =====================
create table public.face_embeddings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  embedding vector(128) not null,
  model text not null default 'face-api-facerecognition-128',
  sample_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.face_embeddings enable row level security;
-- deliberately no select policy: not even the owner reads raw vectors via client
create policy "face_embeddings_insert_own" on public.face_embeddings for insert with check (auth.uid() = user_id);
create policy "face_embeddings_update_own" on public.face_embeddings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.enroll_face_embedding(p_embedding vector(128)) returns void
  language plpgsql security invoker set search_path = public as $$
begin
  if p_embedding is null or vector_dims(p_embedding) <> 128 then
    raise exception 'embedding must be a 128-dimension vector';
  end if;
  insert into public.face_embeddings (user_id, embedding, sample_count, updated_at)
  values (auth.uid(), p_embedding, 1, now())
  on conflict (user_id) do update
    set embedding = excluded.embedding, sample_count = public.face_embeddings.sample_count + 1, updated_at = now();
  update public.profiles set face_enrolled = true, enrollment_status = 'completed', updated_at = now() where id = auth.uid();
end; $$;
grant execute on function public.enroll_face_embedding(vector) to authenticated;

-- distance RPC: service_role only (called from edge functions), never exposes the vector itself
create or replace function public.face_distance(p_user_id uuid, p_embedding vector(128))
  returns table(distance float8) language sql security definer set search_path = public as $$
  select (embedding <-> p_embedding) as distance from public.face_embeddings where user_id = p_user_id;
$$;
revoke execute on function public.face_distance(uuid, vector) from public, anon, authenticated;
grant execute on function public.face_distance(uuid, vector) to service_role;

-- ===================== companies + question_bank =====================
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- 'TCS', 'Wipro', 'Infosys', 'General'
  slug text not null unique,
  pass_threshold_pct int not null default 60,
  technical_duration_min int not null default 45,
  personal_duration_min int not null default 30,
  hr_duration_min int not null default 20,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.companies enable row level security;
create policy "companies_select_all" on public.companies for select using (true);
create policy "companies_write_recruiter" on public.companies for all using (public.is_recruiter()) with check (public.is_recruiter());

create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  round text not null check (round in ('technical','hr')),
  qtype text not null check (qtype in ('mcq','coding','behavioral')),
  category text,
  prompt text not null,
  options jsonb,              -- mcq choices, null otherwise
  correct_answer text,        -- mcq exact match / coding reference solution; null for behavioral
  points int not null default 1,
  created_at timestamptz not null default now()
);
alter table public.question_bank enable row level security;
create policy "question_bank_select_all" on public.question_bank for select using (true);
create policy "question_bank_write_recruiter" on public.question_bank for all using (public.is_recruiter()) with check (public.is_recruiter());

-- ===================== exam_sessions (one per candidate attempt at one company's exam) =====================
create table public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  status text not null default 'face_gate_pending' check (status in (
    'face_gate_pending','pending_manual_review','in_progress',
    'submitted','auto_submitted','cancelled'
  )),
  current_round text check (current_round in ('technical','personal','hr')),
  face_gate_attempts int not null default 0,
  face_gate_passed_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  integrity_score int not null default 100,
  technical_score numeric, technical_pct numeric,
  personal_score numeric, personal_pct numeric,
  hr_score numeric, hr_pct numeric,
  overall_pct numeric,
  created_at timestamptz not null default now()
);
alter table public.exam_sessions enable row level security;
create policy "exam_sessions_own" on public.exam_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exam_sessions_recruiter_select" on public.exam_sessions for select using (public.is_recruiter());
create policy "exam_sessions_recruiter_update" on public.exam_sessions for update using (public.is_recruiter());

-- ===================== exam_responses (per-question answers, persisted) =====================
create table public.exam_responses (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  question_id uuid references public.question_bank(id),
  round text not null check (round in ('technical','personal','hr')),
  answer text,
  score numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.exam_responses enable row level security;
create policy "exam_responses_insert_own" on public.exam_responses for insert
  with check (exists(select 1 from public.exam_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "exam_responses_select_own" on public.exam_responses for select
  using (exists(select 1 from public.exam_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "exam_responses_recruiter_select" on public.exam_responses for select using (public.is_recruiter());

-- ===================== face_gate_attempts (identity+liveness attempt log, feeds manual review) =====================
create table public.face_gate_attempts (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  distance float8,
  liveness_passed boolean not null,
  identity_passed boolean not null,
  snapshot_path text,          -- storage path in 'face-gate-snapshots' bucket
  created_at timestamptz not null default now()
);
alter table public.face_gate_attempts enable row level security;
create policy "face_gate_attempts_insert_own" on public.face_gate_attempts for insert with check (auth.uid() = user_id);
create policy "face_gate_attempts_select_own" on public.face_gate_attempts for select using (auth.uid() = user_id);
create policy "face_gate_attempts_recruiter_select" on public.face_gate_attempts for select using (public.is_recruiter());

-- ===================== violations (continuous proctoring log across all 3 rounds) =====================
create table public.violations (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('NO_FACE','MULTIPLE_FACES','LOOKING_AWAY','IDENTITY_MISMATCH','TAB_HIDDEN')),
  severity text not null check (severity in ('warning','critical')),
  message text not null,
  snapshot_path text,          -- storage path in 'violation-snapshots' bucket
  created_at timestamptz not null default now()
);
alter table public.violations enable row level security;
create policy "violations_insert_own" on public.violations for insert with check (auth.uid() = user_id);
create policy "violations_select_own" on public.violations for select using (auth.uid() = user_id);
create policy "violations_recruiter_select" on public.violations for select using (public.is_recruiter());

-- ===================== user_activity (recruiter live-presence dashboard) =====================
create table public.user_activity (
  uid uuid primary key references auth.users(id) on delete cascade,
  email text not null, display_name text,
  user_type text not null check (user_type in ('candidate','recruiter')),
  status text not null default 'active' check (status in ('active','inactive')),
  login_time timestamptz, last_activity timestamptz, current_page text, device_info text,
  face_enrolled boolean default false, updated_at timestamptz not null default now()
);
alter table public.user_activity enable row level security;
create policy "user_activity_insert_own" on public.user_activity for insert with check (auth.uid() = uid);
create policy "user_activity_update_own" on public.user_activity for update using (auth.uid() = uid) with check (auth.uid() = uid);
create policy "user_activity_select_own" on public.user_activity for select using (auth.uid() = uid);
create policy "user_activity_select_recruiter" on public.user_activity for select using (public.is_recruiter());
alter publication supabase_realtime add table public.user_activity;

-- No ivfflat index on face_embeddings.embedding: all lookups are 1:1 by user_id primary key.
