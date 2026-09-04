-- Private account metadata used by the Worker for ID-based authentication.
-- Passwords remain exclusively in Supabase Auth.

create table public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique
    check (
      login_id = lower(login_id)
      and char_length(login_id) between 4 and 24
      and login_id ~ '^[a-z0-9._-]+$'
    ),
  email text not null check (char_length(btrim(email)) between 3 and 320),
  coach_name text not null check (char_length(btrim(coach_name)) between 1 and 40),
  school_name text not null check (char_length(btrim(school_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index account_profiles_email_lower_idx
  on public.account_profiles(lower(email));

alter table public.account_profiles enable row level security;

-- Account metadata is intentionally invisible to browser roles. The Worker
-- resolves login IDs and returns only the authenticated user's own profile.
revoke all on table public.account_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.account_profiles to service_role;
