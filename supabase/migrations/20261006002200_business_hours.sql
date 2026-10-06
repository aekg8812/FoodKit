-- Batch 2E-3A: Business hours DB infrastructure
-- Adds business_hours_known column, restaurant_business_hours table,
-- and is_restaurant_open_at / is_restaurant_open_now functions.
-- Timezone: Asia/Tokyo (explicit, never depends on DB server timezone).

-- ----------------------------------------------------------------
-- 1. Add business_hours_known to restaurants
-- ----------------------------------------------------------------
-- false (default): hours unknown / not entered
-- true: day-specific hours have been confirmed.
--   A true row with no slots for a given day means that day is closed.
alter table public.restaurants
  add column business_hours_known boolean not null default false;

-- ----------------------------------------------------------------
-- 2. restaurant_business_hours table
-- ----------------------------------------------------------------
create table public.restaurant_business_hours (
  id              uuid      not null default gen_random_uuid(),
  restaurant_id   uuid      not null references public.restaurants(id) on delete cascade,
  day_of_week     smallint  not null,   -- 0=Sun 1=Mon … 6=Sat
  opens_at        time      not null,
  closes_at       time      not null,
  closes_next_day boolean   not null default false,

  constraint restaurant_business_hours_pkey
    primary key (id),

  -- day_of_week must be 0–6
  constraint restaurant_business_hours_dow_check
    check (day_of_week between 0 and 6),

  -- Time validity:
  --   Normal (closes_next_day=false): opens_at < closes_at  e.g. 11:00→22:00
  --   Day-crossing (closes_next_day=true): closes_at < opens_at  e.g. 22:00→02:00
  --   This prevents 09:00→17:00 with closes_next_day=true (17:00 > 09:00 → rejected).
  --   opens_at = closes_at is implicitly forbidden by both strict-less-than clauses.
  constraint restaurant_business_hours_time_check
    check (
      (not closes_next_day and opens_at < closes_at)
      or  (closes_next_day and closes_at < opens_at)
    ),

  -- Prevent exact duplicate slots; multiple non-identical rows per
  -- (restaurant_id, day_of_week) are allowed (for break-time splits).
  constraint restaurant_business_hours_no_duplicate
    unique (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
);

-- ----------------------------------------------------------------
-- 3. Index for (restaurant_id, day_of_week) lookups
-- ----------------------------------------------------------------
create index restaurant_business_hours_restaurant_dow_idx
  on public.restaurant_business_hours (restaurant_id, day_of_week);

-- ----------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------
alter table public.restaurant_business_hours enable row level security;

-- SELECT: visible only if the parent restaurant is visible to this user.
-- The subquery runs under the caller's role so restaurants RLS is applied
-- automatically.  No recursion: restaurant_business_hours → restaurants
-- (restaurants policies never reference restaurant_business_hours).
create policy "rbh_select_if_restaurant_visible"
  on public.restaurant_business_hours
  for select
  to authenticated
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id
    )
  );

-- No INSERT/UPDATE/DELETE policies in Phase 1.
-- Direct writes by general authenticated users are intentionally blocked.

-- ----------------------------------------------------------------
-- 5. is_restaurant_open_at  (testable core — accepts explicit timestamp)
-- ----------------------------------------------------------------
-- security invoker (default): runs with the caller's role, so RLS on
-- restaurants and restaurant_business_hours applies.  A user who cannot
-- see a restaurant via RLS will get false — no information leakage.
create or replace function public.is_restaurant_open_at(
  p_restaurant_id  uuid,
  p_at             timestamptz
)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select
    case
      -- If business_hours_known is false, NULL (restaurant not visible via RLS),
      -- or restaurant not found → treat as closed.
      when (
        select r.business_hours_known
        from   public.restaurants r
        where  r.id = p_restaurant_id
      ) is not true
      then false

      -- Otherwise check if p_at falls within any open slot visible to the caller.
      else
        coalesce(
          (
            select bool_or(
              case
                -- Normal slot (same calendar day, no midnight crossing)
                when h.day_of_week = loc.dow and not h.closes_next_day then
                  loc.t >= h.opens_at and loc.t < h.closes_at

                -- Day-crossing slot — we are on the *starting* day
                when h.day_of_week = loc.dow and h.closes_next_day then
                  loc.t >= h.opens_at

                -- Day-crossing slot — we are on the *next* day (before close)
                else
                  loc.t < h.closes_at
              end
            )
            from public.restaurant_business_hours h
            cross join lateral (
              select
                extract(dow from (p_at at time zone 'Asia/Tokyo'))::smallint as dow,
                (p_at at time zone 'Asia/Tokyo')::time                       as t
            ) loc
            where h.restaurant_id = p_restaurant_id
              and (
                -- Slot starts on current day of week
                h.day_of_week = loc.dow
                -- OR slot started on the previous day and crosses midnight into today
                or (h.closes_next_day and h.day_of_week = (loc.dow + 6) % 7)
              )
          ),
          false   -- no matching slots → restaurant is closed / holiday
        )
    end
$$;

revoke all on function public.is_restaurant_open_at(uuid, timestamptz) from public;
revoke all on function public.is_restaurant_open_at(uuid, timestamptz) from anon;
grant  execute on function public.is_restaurant_open_at(uuid, timestamptz) to authenticated;

-- ----------------------------------------------------------------
-- 6. is_restaurant_open_now  (thin wrapper — passes now() to open_at)
-- ----------------------------------------------------------------
-- Also security invoker; inherits caller's RLS context.
create or replace function public.is_restaurant_open_now(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select public.is_restaurant_open_at(p_restaurant_id, now())
$$;

revoke all on function public.is_restaurant_open_now(uuid) from public;
revoke all on function public.is_restaurant_open_now(uuid) from anon;
grant  execute on function public.is_restaurant_open_now(uuid) to authenticated;
