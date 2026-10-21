-- Restaurant metadata UPDATE template
-- Usage: copy one block per restaurant, fill in confirmed values, run via psql.
-- NEVER guess or fabricate values. Only insert values verified from a real source.
-- Run against local DB first, then production after migration is applied.
--
-- Allowed values reminder:
--   party_size_tags:  solo | pair | small_group | large_group
--   atmosphere_tags:  lively | relaxed | casual
--   meal_period_tags: lunch | dinner
--   walk_in_available / parking_available: true | false (not NULL when known)
--   budget_per_person_max_yen: integer yen > 0

-- ============================================================
-- Template (copy-paste per restaurant, replace values)
-- ============================================================

/*
UPDATE public.restaurants SET
  lat                       = <decimal>,
  lng                       = <decimal>,
  budget_per_person_max_yen = <integer>,
  party_size_tags           = ARRAY['<tag1>','<tag2>'],
  atmosphere_tags           = ARRAY['<tag1>'],
  walk_in_available         = <true|false>,
  parking_available         = <true|false>,
  meal_period_tags          = ARRAY['lunch','dinner'],
  business_hours_known      = false  -- set true only after inserting restaurant_business_hours rows
WHERE id = '<uuid>';
*/

-- ============================================================
-- Business hours template (run AFTER setting business_hours_known = true)
-- day_of_week: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
-- ============================================================

/*
INSERT INTO public.restaurant_business_hours
  (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
VALUES
  ('<uuid>', 1, '11:00', '22:00', false),  -- Mon
  ('<uuid>', 2, '11:00', '22:00', false),  -- Tue
  ('<uuid>', 3, '11:00', '22:00', false),  -- Wed
  ('<uuid>', 4, '11:00', '22:00', false),  -- Thu
  ('<uuid>', 5, '11:00', '22:00', false),  -- Fri
  ('<uuid>', 6, '11:00', '22:00', false);  -- Sat
-- (omit closed days; no row = closed that day)

-- Then set the flag:
UPDATE public.restaurants SET business_hours_known = true WHERE id = '<uuid>';
*/

-- ============================================================
-- Actual updates — fill below after human verification
-- ============================================================

-- (empty — waiting for human-verified data)
