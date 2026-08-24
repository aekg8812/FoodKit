-- A3: follows foundation, public profile views, and mutual-follow review visibility

create table public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references public.users(id) on delete cascade,
  followee_id  uuid not null references public.users(id) on delete cascade,
  status       text not null default 'accepted',
  created_at   timestamptz not null default now(),
  constraint follows_unique unique (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id),
  constraint follows_status_check check (status in ('pending', 'accepted'))
);

create index follows_followee_idx on public.follows (followee_id, status);
create index follows_follower_idx on public.follows (follower_id, status);

alter table public.follows enable row level security;

create policy follows_select_own on public.follows
for select
to authenticated
using (follower_id = auth.uid() or followee_id = auth.uid());

create policy follows_insert_own on public.follows
for insert
to authenticated
with check (follower_id = auth.uid() and status = 'accepted');

create policy follows_delete_own on public.follows
for delete
to authenticated
using (follower_id = auth.uid());

grant select, insert, delete on public.follows to authenticated;

revoke update, truncate, references, trigger
on public.follows
from authenticated;

create or replace function public.is_mutual_follow(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.follows f1
    join public.follows f2
      on f2.follower_id = f1.followee_id
     and f2.followee_id = f1.follower_id
    where f1.follower_id = auth.uid()
      and f1.followee_id = p_other_user_id
      and f1.status = 'accepted'
      and f2.status = 'accepted'
  );
$$;

revoke all on function public.is_mutual_follow(uuid) from public;
grant execute on function public.is_mutual_follow(uuid) to authenticated;

create or replace function public.get_friend_count(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)
  from public.follows f1
  join public.follows f2
    on f2.follower_id = f1.followee_id
   and f2.followee_id = f1.follower_id
  where f1.follower_id = p_user_id
    and f1.status = 'accepted'
    and f2.status = 'accepted';
$$;

revoke all on function public.get_friend_count(uuid) from public;
grant execute on function public.get_friend_count(uuid) to authenticated;

create or replace view public.user_public_profiles
with (security_invoker = false) as
  select
    u.id,
    u.username,
    u.name,
    u.onboarding_completed
  from public.users u;

comment on view public.user_public_profiles is
  '公開プロフィール。users 本体は self-only RLS のため、他ユーザーの表示は必ずこの view を使う。email 等の非公開列を追加しないこと。';

grant select on public.user_public_profiles to authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.user_public_profiles
from authenticated;

create or replace view public.user_public_value_profiles
with (security_invoker = false) as
  select
    p.user_id,
    p.main_value_type,
    p.profile_completion
  from public.user_value_profiles p;

comment on view public.user_public_value_profiles is
  '公開価値観プロフィール。内部値を追加せず、公開可能な列だけを保持する。';

grant select on public.user_public_value_profiles to authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.user_public_value_profiles
from authenticated;

drop policy users_select_own_or_same_group on public.users;
create policy users_select_own on public.users
for select
to authenticated
using (id = auth.uid());

drop policy user_value_profiles_select_own_or_same_group on public.user_value_profiles;
create policy user_value_profiles_select_own on public.user_value_profiles
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.search_users_by_username(p_query text)
returns table (id uuid, username text, name text, main_value_type text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.username, u.name, p.main_value_type::text
  from public.user_public_profiles u
  left join public.user_public_value_profiles p on p.user_id = u.id
  -- 2文字未満は0件。全件列挙を防ぐ。
  where length(trim(p_query)) >= 2
    -- 前方一致のみ。部分一致（%foo%）はインデックスが効かず、
    -- 総当たりで他人を列挙されやすい。
    --
    -- '_' はユーザーIDに使える文字であると同時に LIKE のワイルドカード
    -- （任意の1文字）でもあるため、エスケープしないと ayato_k で ayatoXk が
    -- ヒットする。置換は \ → % → _ の順で行うこと。'_' を先に置換すると
    -- そこで挿入した '\' を後段の '\' 置換が再度エスケープし、二重エスケープで壊れる。
    and lower(u.username) like
        replace(replace(replace(lower(trim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        escape '\'
    -- 自分は結果に出さない
    and u.id <> auth.uid()
  order by length(u.username), lower(u.username)
  limit 20;
$$;

create or replace function public.can_view_review(p_review_user_id uuid, p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_review_user_id = auth.uid()
    or exists (
      select 1
      from public.restaurant_accesses ra
      join public.group_members gm_me
        on gm_me.group_id = ra.group_id and gm_me.user_id = auth.uid()
      join public.group_members gm_them
        on gm_them.group_id = ra.group_id and gm_them.user_id = p_review_user_id
      where ra.restaurant_id = p_restaurant_id
        and ra.visibility = 'group'
    )
    or exists (
      select 1
      from public.follows f1
      join public.follows f2
        on f2.follower_id = f1.followee_id
       and f2.followee_id = f1.follower_id
      where f1.follower_id = auth.uid()
        and f1.followee_id = p_review_user_id
        and f1.status = 'accepted'
        and f2.status = 'accepted'
    )
  ;
$$;
