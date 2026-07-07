create extension if not exists pgcrypto;

create type public.visibility_type as enum ('private', 'group', 'public');
create type public.group_member_role as enum ('owner', 'member');
create type public.restaurant_source as enum ('manual', 'google_place', 'imported');
create type public.value_type as enum (
  'cost',
  'taste',
  'atmosphere',
  'cleanliness',
  'speed',
  'exploration'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  value_type public.value_type,
  onboarding_completed boolean not null default false,
  profile_completion integer not null default 0 check (
    profile_completion between 0 and 100
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_groups_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.group_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);
create index group_members_group_id_idx on public.group_members (group_id);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text,
  genre text,
  address text,
  memo text,
  created_by uuid not null references public.users(id) on delete cascade,
  source public.restaurant_source not null default 'manual',
  external_place_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_restaurants_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

create table public.restaurant_accesses (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  visibility public.visibility_type not null default 'group',
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (visibility = 'group' and group_id is not null and user_id is null)
    or
    (visibility = 'private' and user_id is not null and group_id is null)
    or
    (visibility = 'public' and group_id is null and user_id is null)
  )
);

create unique index restaurant_accesses_group_unique_idx
on public.restaurant_accesses (restaurant_id, group_id)
where visibility = 'group';

create unique index restaurant_accesses_private_unique_idx
on public.restaurant_accesses (restaurant_id, user_id)
where visibility = 'private';

create unique index restaurant_accesses_public_unique_idx
on public.restaurant_accesses (restaurant_id)
where visibility = 'public';

create index restaurant_accesses_group_id_idx on public.restaurant_accesses (group_id);
create index restaurant_accesses_restaurant_id_idx on public.restaurant_accesses (restaurant_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  rating integer not null check (rating between 1 and 4),
  comment text,
  visit_date date,
  visibility public.visibility_type not null default 'group',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create index reviews_group_id_idx on public.reviews (group_id);
create index reviews_restaurant_id_idx on public.reviews (restaurant_id);
create index reviews_user_id_idx on public.reviews (user_id);
create index reviews_rating_idx on public.reviews (rating);

create table public.user_value_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  main_value_type public.value_type,
  scores_json jsonb not null default '{}'::jsonb,
  confidence numeric(4, 3) not null default 0 check (
    confidence >= 0 and confidence <= 1
  ),
  profile_completion integer not null default 0 check (
    profile_completion between 0 and 100
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_user_value_profiles_updated_at
before update on public.user_value_profiles
for each row execute function public.set_updated_at();

create index user_value_profiles_main_value_type_idx
on public.user_value_profiles (main_value_type);

create table public.value_questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  dimension public.value_type not null,
  is_initial boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.value_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.value_questions(id) on delete cascade,
  option_text text not null,
  value_type public.value_type not null,
  score integer not null default 1 check (score >= 0)
);

create index value_options_question_id_idx
on public.value_options (question_id);

create table public.user_value_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  question_id uuid not null references public.value_questions(id) on delete cascade,
  option_id uuid not null references public.value_options(id) on delete cascade,
  answered_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index user_value_answers_user_id_idx on public.user_value_answers (user_id);