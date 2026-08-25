-- Phase 1 schema. Run this in your Supabase project's SQL editor
-- (Dashboard -> SQL Editor -> New query) after creating the project.
--
-- Auth (email/password, sessions) is handled entirely by Supabase's
-- built-in auth.users table -- nothing to set up there. The tables below
-- are the app-specific data that hangs off each authenticated user.

-- Groups are minimal for Phase 1: every new user is auto-joined to one
-- shared "Beta Testers" group (handled in application code on signup),
-- so the feed has real shared content even before the full Groups UI
-- (join/create/invite codes) is built in Phase 2.
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_at timestamptz default now()
);

-- One row per user, extending Supabase's built-in auth.users with the
-- app-specific profile fields shown in the Profile screen mockup.
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  screen_name text not null,
  avatar_url text,
  height text,
  weight text,
  gender text,
  group_id uuid references groups(id),
  created_at timestamptz default now()
);

-- Logged sets from Gym Mode.
create table gym_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  exercise text not null,
  sets int not null,
  reps int not null,
  weight_lbs int not null,
  failed boolean not null default false,
  is_pr boolean not null default false,
  created_at timestamptz default now()
);

-- Roast feed posts. activity_type drives the colored badge shown on
-- each post (e.g. 'GYM_FAIL', 'GYM_PR').
create table feed_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  group_id uuid references groups(id) not null,
  activity_type text not null,
  body text not null,
  created_at timestamptz default now()
);

create table feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references feed_posts(id) not null,
  user_id uuid references profiles(id) not null,
  body text,
  image_url text,
  created_at timestamptz default now()
);

-- Row Level Security: everyone can only see/act within their own group,
-- and can only write their own data. This is real security enforced by
-- the database itself, not just the app's UI.
alter table groups enable row level security;
alter table profiles enable row level security;
alter table gym_sets enable row level security;
alter table feed_posts enable row level security;
alter table feed_comments enable row level security;

-- Several policies below need "what group is the current user in?".
-- A raw subquery like (select group_id from profiles where id =
-- auth.uid()) causes infinite recursion when used inside a policy on
-- profiles itself -- Postgres re-triggers that same policy to decide if
-- the subquery's own row is visible, which runs the subquery again,
-- forever. This SECURITY DEFINER function looks it up with the function
-- owner's privileges instead, bypassing RLS internally and breaking the
-- recursive cycle.
create or replace function public.get_my_group_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from profiles where id = auth.uid()
$$;

create policy "Any authenticated user can look up groups"
  on groups for select
  to authenticated
  using (true);

create policy "Users can view profiles in their own group"
  on profiles for select
  using (group_id = public.get_my_group_id());

create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

create policy "Users can insert their own profile"
  on profiles for insert
  with check (id = auth.uid());

create policy "Users can view gym sets in their group"
  on gym_sets for select
  using (
    user_id in (
      select id from profiles where group_id = public.get_my_group_id()
    )
  );

create policy "Users can log their own gym sets"
  on gym_sets for insert
  with check (user_id = auth.uid());

create policy "Users can view feed posts in their group"
  on feed_posts for select
  using (group_id = public.get_my_group_id());

create policy "Users can create feed posts in their group"
  on feed_posts for insert
  with check (
    user_id = auth.uid()
    and group_id = public.get_my_group_id()
  );

create policy "Users can view comments in their group's posts"
  on feed_comments for select
  using (
    post_id in (
      select id from feed_posts where group_id = public.get_my_group_id()
    )
  );

create policy "Users can comment as themselves"
  on feed_comments for insert
  with check (user_id = auth.uid());

-- Seed the one shared Phase 1 test group. Every new signup gets added
-- to this group automatically (see src/lib/auth.js).
insert into groups (name, invite_code) values ('Beta Testers', 'ROAST-BETA1');
