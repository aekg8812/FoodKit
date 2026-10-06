-- V2 preference cards: master table, user selections, RLS, and set_my_preference_cards RPC.

-- ────────────────────────────────────────────────────────
-- Master cards table
-- ────────────────────────────────────────────────────────
create table if not exists public.preference_cards (
  id          uuid        primary key default gen_random_uuid(),
  key         text        not null unique,
  label       text        not null,
  description text,
  image_path  text,
  sort_order  integer     not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────
-- User selections table
-- Composite PK prevents duplicate entries.
-- ────────────────────────────────────────────────────────
create table if not exists public.user_preference_cards (
  user_id            uuid        not null references public.users(id) on delete cascade,
  preference_card_id uuid        not null references public.preference_cards(id),
  created_at         timestamptz not null default now(),
  primary key (user_id, preference_card_id)
);

-- ────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────
alter table public.preference_cards      enable row level security;
alter table public.user_preference_cards enable row level security;

-- All authenticated users can read the master card list.
create policy "authenticated can read preference_cards"
  on public.preference_cards for select
  to authenticated
  using (true);

-- Users can read only their own selections.
create policy "users can read own preference card selections"
  on public.user_preference_cards for select
  to authenticated
  using (user_id = auth.uid());

-- ────────────────────────────────────────────────────────
-- Seed 10 official V2 cards (sort_order matches screen order)
-- ────────────────────────────────────────────────────────
insert into public.preference_cards (key, label, description, image_path, sort_order) values
  ('cost_conscious',    '安く食べたい',          'コスパを重視',              null, 1),
  ('local_discovery',   '地元のお店を開拓したい', '知らない店にも行ってみたい', null, 2),
  ('hearty_meal',       '量もしっかりほしい',     '満足感重視',                null, 3),
  ('good_reputation',   '評判のいい店を選びたい', '失敗したくない',             null, 4),
  ('lively_atmosphere', 'にぎやかな店が好き',     '友達とワイワイ',             null, 5),
  ('quiet_atmosphere',  '静かな店が好き',         'ゆっくり話したい',           null, 6),
  ('solo_friendly',     '1人でも入りやすい',      '気軽に使える店',             null, 7),
  ('friends_friendly',  '友達と行きやすい',       'みんなで楽しめる',           null, 8),
  ('taste_focused',     '味にはこだわりたい',     'おいしいものを食べたい',     null, 9),
  ('quick_service',     '提供が早いとうれしい',   '待ち時間は短く',             null, 10)
on conflict (key) do nothing;

-- ────────────────────────────────────────────────────────
-- set_my_preference_cards RPC
-- Validates and atomically replaces a user's card selection.
-- Also sets onboarding_completed = true on success so getUserState
-- continues to work without modification.
-- ────────────────────────────────────────────────────────
create or replace function public.set_my_preference_cards(
  p_card_keys text[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid          uuid;
  v_keys         text[];
  v_card_ids     uuid[];
  v_invalid_keys text[];
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_card_keys is null then
    raise exception 'p_card_keys must not be null';
  end if;

  -- Deduplicate input.
  select array_agg(distinct k order by k) into v_keys
  from unnest(p_card_keys) k;

  v_keys := coalesce(v_keys, '{}'::text[]);

  if cardinality(v_keys) < 5 then
    raise exception 'at least 5 cards required (got %)', cardinality(v_keys);
  end if;

  if cardinality(v_keys) > 10 then
    raise exception 'at most 10 cards allowed (got %)', cardinality(v_keys);
  end if;

  -- Reject unknown or inactive keys.
  select array_agg(k) into v_invalid_keys
  from unnest(v_keys) k
  where not exists (
    select 1 from public.preference_cards pc
    where pc.key = k and pc.is_active = true
  );

  if v_invalid_keys is not null and cardinality(v_invalid_keys) > 0 then
    raise exception 'unknown or inactive card keys: %', array_to_string(v_invalid_keys, ', ');
  end if;

  -- Collect card IDs.
  select array_agg(pc.id) into v_card_ids
  from public.preference_cards pc
  where pc.key = any(v_keys);

  -- Atomically replace selection.
  delete from public.user_preference_cards
  where user_id = v_uid;

  insert into public.user_preference_cards (user_id, preference_card_id)
  select v_uid, unnest(v_card_ids);

  -- Mark onboarding complete so getUserState requires no changes.
  update public.users
  set onboarding_completed = true
  where id = v_uid;

end;
$$;

revoke all on function public.set_my_preference_cards(text[]) from public;
revoke all on function public.set_my_preference_cards(text[]) from anon;
grant  execute on function public.set_my_preference_cards(text[]) to authenticated;
