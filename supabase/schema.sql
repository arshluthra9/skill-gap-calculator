-- Run in Supabase SQL Editor. Review policies before production use.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text, degree text, year_of_study text, specialisation text,
 role text not null default 'student' check (role in ('student','admin')),
 created_at timestamptz not null default now()
);
create table public.assessments (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'in_progress' check(status in ('in_progress','completed')),
 current_stage int not null default 1 check(current_stage between 1 and 6),
 answers jsonb not null default '{}'::jsonb,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.skills (
 id uuid primary key default gen_random_uuid(), name text unique not null,
 category text not null check(category in ('technical','non_technical')), description text
);
create table public.career_roles (
 id uuid primary key default gen_random_uuid(), title text unique not null,
 description text, suitable_degrees text[] not null default '{}'
);
create table public.career_skill_requirements (
 career_id uuid not null references public.career_roles(id) on delete cascade,
 skill_id uuid not null references public.skills(id) on delete cascade,
 required_level numeric(2,1) not null default 3 check(required_level between 0 and 5),
 weight numeric(5,2) not null default 1 check(weight > 0),
 primary key(career_id,skill_id)
);
create table public.student_skill_ratings (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 assessment_id uuid references public.assessments(id) on delete cascade,
 skill_id uuid not null references public.skills(id) on delete cascade,
 rating numeric(2,1) not null check(rating between 0 and 5),
 source text not null check(source in ('self_reported','tested')),
 evidence_note text, created_at timestamptz not null default now()
);
create table public.courses (
 id uuid primary key default gen_random_uuid(), title text not null, provider text,
 url text, skill_id uuid references public.skills(id) on delete set null,
 is_free boolean not null default false, certificate_info text, active boolean not null default true
);
create table public.roadmaps (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references auth.users(id) on delete cascade,
 assessment_id uuid references public.assessments(id) on delete set null,
 title text not null, plan jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create table public.progress_entries (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references auth.users(id) on delete cascade,
 skill_id uuid references public.skills(id) on delete set null, activity text not null,
 minutes_spent int check(minutes_spent is null or minutes_spent >= 0), completed_at timestamptz not null default now()
);
create table public.contact_messages (
 id uuid primary key default gen_random_uuid(), email text not null, message text not null,
 student_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.skills enable row level security;
alter table public.career_roles enable row level security;
alter table public.career_skill_requirements enable row level security;
alter table public.student_skill_ratings enable row level security;
alter table public.courses enable row level security;
alter table public.roadmaps enable row level security;
alter table public.progress_entries enable row level security;
alter table public.contact_messages enable row level security;
alter table public.admin_users enable row level security;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.admin_users where user_id=auth.uid());
$$;
create policy "profile read own or admin" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "profile insert own" on public.profiles for insert with check(id=auth.uid());
create policy "profile update own or admin" on public.profiles for update using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
create policy "assessment own" on public.assessments for all using(student_id=auth.uid() or public.is_admin()) with check(student_id=auth.uid() or public.is_admin());
create policy "skills readable" on public.skills for select using(true);
create policy "careers readable" on public.career_roles for select using(true);
create policy "requirements readable" on public.career_skill_requirements for select using(true);
create policy "ratings own" on public.student_skill_ratings for all using(student_id=auth.uid() or public.is_admin()) with check(student_id=auth.uid() or public.is_admin());
create policy "courses readable active" on public.courses for select using(active=true or public.is_admin());
create policy "roadmaps own" on public.roadmaps for all using(student_id=auth.uid() or public.is_admin()) with check(student_id=auth.uid() or public.is_admin());
create policy "progress own" on public.progress_entries for all using(student_id=auth.uid() or public.is_admin()) with check(student_id=auth.uid() or public.is_admin());
create policy "contact insert public" on public.contact_messages for insert with check(student_id is null or student_id=auth.uid());
create policy "contact admin read" on public.contact_messages for select using(public.is_admin());
create policy "admin list self" on public.admin_users for select using(user_id=auth.uid());
-- Create an admin safely after signup, from SQL editor only:
-- insert into public.admin_users(user_id) values ('YOUR_AUTH_USER_UUID');
-- Insert a profile row from a trusted server-side signup flow or a secure trigger.
