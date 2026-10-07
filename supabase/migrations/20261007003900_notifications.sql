-- M6: notifications table + triggers + read RPCs

-- ── Table ──────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id                uuid        primary key default gen_random_uuid(),
  recipient_user_id uuid        not null references public.users(id)   on delete cascade,
  type              text        not null,
  subject_user_id   uuid        not null references public.users(id)   on delete cascade,
  review_id         uuid        references public.reviews(id)          on delete cascade,
  read_at           timestamptz null,
  created_at        timestamptz not null default now(),

  constraint notifications_type_check
    check (type in ('followed_user', 'followed_by_user', 'group_member_review'))
);

create index if not exists idx_notifications_recipient_created
  on public.notifications(recipient_user_id, created_at desc);

create index if not exists idx_notifications_unread
  on public.notifications(recipient_user_id)
  where read_at is null;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for authenticated users:
-- inserts are done by security-definer trigger functions,
-- updates are done by mark_notification_read / mark_all_notifications_read RPCs.

-- ── mark_notification_read ─────────────────────────────────────────────────
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.notifications
  set    read_at = now()
  where  id                = p_notification_id
    and  recipient_user_id = auth.uid()
    and  auth.uid()       is not null
    and  read_at          is null;
$$;

revoke all  on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- ── mark_all_notifications_read ────────────────────────────────────────────
create or replace function public.mark_all_notifications_read()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with updated as (
    update public.notifications
    set    read_at = now()
    where  recipient_user_id = auth.uid()
      and  auth.uid()       is not null
      and  read_at          is null
    returning id
  )
  select count(*)::integer from updated;
$$;

revoke all  on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ── Follow notification trigger ────────────────────────────────────────────
create or replace function public.handle_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Fire only when status first becomes 'accepted' (idempotent on re-accept).
  if new.status = 'accepted'
     and (tg_op = 'INSERT' or old.status is distinct from 'accepted')
  then
    insert into public.notifications(recipient_user_id, type, subject_user_id)
    values
      (new.follower_id, 'followed_user',    new.followee_id),
      (new.followee_id, 'followed_by_user', new.follower_id);
  end if;
  return new;
end;
$$;

-- Prevent direct EXECUTE (runs only as a trigger)
revoke all on function public.handle_follow_notification() from public, anon, authenticated;

create trigger after_follow_accepted
  after insert or update of status
  on public.follows
  for each row execute function public.handle_follow_notification();

-- ── Group-review notification trigger ─────────────────────────────────────
create or replace function public.handle_review_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only on new INSERT; UPDATE does not generate notifications.
  if tg_op != 'INSERT' then return new; end if;

  -- One notification per unique co-group member (author excluded, deduplicated).
  insert into public.notifications(recipient_user_id, type, subject_user_id, review_id)
  select distinct
    gm.user_id,
    'group_member_review',
    new.user_id,
    new.id
  from public.group_members gm
  where gm.user_id != new.user_id
    and exists (
      select 1 from public.group_members gm2
      where gm2.group_id = gm.group_id
        and gm2.user_id  = new.user_id
    );

  return new;
end;
$$;

revoke all on function public.handle_review_notification() from public, anon, authenticated;

create trigger after_review_insert
  after insert
  on public.reviews
  for each row execute function public.handle_review_notification();
