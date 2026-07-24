-- Task A-2: handle_new_user trigger
--
-- auth.uid() is NULL when this trigger fires.
-- RLS is bypassed because this function is owned by postgres (superuser / table owner).

drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, email, name, value_type, onboarding_completed, profile_completion)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    null,
    false,
    0
  )
  on conflict (id) do nothing;

  insert into public.user_value_profiles (user_id, main_value_type, scores_json, confidence, profile_completion)
  values (
    new.id,
    null,
    '{"cost":0,"taste":0,"atmosphere":0,"hospitality":0}'::jsonb,
    0,
    0
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Task B: Seed value_questions and value_options (MVP production data)
--
-- Q1 is a branching question only; it does not directly determine main_value_type.
-- main_value_type is determined by the app-side branching matrix, not by score totals.

with
  q1 as (
    insert into public.value_questions (question_text, dimension, is_initial, sort_order, is_active)
    values ('お店選びで、料理そのものの質を最優先しますか？', 'taste', true, 1, true)
    returning id
  ),
  q2a as (
    insert into public.value_questions (question_text, dimension, is_initial, sort_order, is_active)
    values ('多少値段が高くても、美味しさを優先しますか？', 'cost', true, 2, true)
    returning id
  ),
  q2b as (
    insert into public.value_questions (question_text, dimension, is_initial, sort_order, is_active)
    values ('お店の良さは、店員さんの人柄や接客で決まると思いますか？', 'hospitality', true, 3, true)
    returning id
  )
insert into public.value_options (question_id, option_text, value_type, score)
select q1.id,  'はい',   'taste'::public.value_type,       1 from q1  union all
select q1.id,  'いいえ', 'atmosphere'::public.value_type,  1 from q1  union all
select q2a.id, 'はい',   'taste'::public.value_type,       1 from q2a union all
select q2a.id, 'いいえ', 'cost'::public.value_type,        1 from q2a union all
select q2b.id, 'はい',   'hospitality'::public.value_type, 1 from q2b union all
select q2b.id, 'いいえ', 'atmosphere'::public.value_type,  1 from q2b;
