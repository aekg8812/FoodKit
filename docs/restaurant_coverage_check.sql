-- Restaurant metadata coverage checker
-- Run after data entry to verify completion status.
-- Usage: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f docs/restaurant_coverage_check.sql

-- ============================================================
-- 1. Overall coverage counts and percentages
-- ============================================================

SELECT
  COUNT(*)                                                          AS total_restaurants,
  COUNT(lat)                                                        AS lat_populated,
  COUNT(lng)                                                        AS lng_populated,
  COUNT(*) FILTER (WHERE business_hours_known = true)               AS business_hours_populated,
  COUNT(budget_per_person_max_yen)                                  AS budget_populated,
  COUNT(party_size_tags)                                            AS party_populated,
  COUNT(atmosphere_tags)                                            AS vibe_populated,
  COUNT(walk_in_available)                                          AS walkin_populated,
  COUNT(parking_available)                                          AS parking_populated,
  COUNT(meal_period_tags)                                           AS meal_populated,

  ROUND(COUNT(lat)::numeric                    / COUNT(*) * 100, 1) AS lat_pct,
  ROUND(COUNT(*) FILTER (WHERE business_hours_known)::numeric
                                               / COUNT(*) * 100, 1) AS hours_pct,
  ROUND(COUNT(budget_per_person_max_yen)::numeric / COUNT(*) * 100, 1) AS budget_pct,
  ROUND(COUNT(party_size_tags)::numeric        / COUNT(*) * 100, 1) AS party_pct,
  ROUND(COUNT(atmosphere_tags)::numeric        / COUNT(*) * 100, 1) AS vibe_pct,
  ROUND(COUNT(walk_in_available)::numeric      / COUNT(*) * 100, 1) AS walkin_pct,
  ROUND(COUNT(parking_available)::numeric      / COUNT(*) * 100, 1) AS parking_pct,
  ROUND(COUNT(meal_period_tags)::numeric       / COUNT(*) * 100, 1) AS meal_pct
FROM public.restaurants;

-- ============================================================
-- 2. Functional readiness — candidates per filter type
--    (how many restaurants CAN be returned when each filter is applied)
-- ============================================================

SELECT
  COUNT(*)                                                              AS total,

  -- distance-ready: has lat+lng (can be filtered by distance)
  COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL)           AS distance_ready,

  -- budget-ready: has budget_per_person_max_yen (can be filtered by budget)
  COUNT(*) FILTER (WHERE budget_per_person_max_yen IS NOT NULL)         AS budget_ready,

  -- party-ready: has party_size_tags (can match party filter)
  COUNT(*) FILTER (WHERE party_size_tags IS NOT NULL)                   AS party_ready,

  -- vibe-ready: has atmosphere_tags (can match vibe filter)
  COUNT(*) FILTER (WHERE atmosphere_tags IS NOT NULL)                   AS vibe_ready,

  -- open-now-ready: has business_hours rows (can apply open_now filter)
  COUNT(*) FILTER (WHERE business_hours_known = true)                   AS open_now_ready,

  -- walk-in-ready: walk_in_available = true (passes walk-in filter)
  COUNT(*) FILTER (WHERE walk_in_available IS TRUE)                     AS walkin_true,

  -- parking-ready: parking_available = true (passes parking filter)
  COUNT(*) FILTER (WHERE parking_available IS TRUE)                     AS parking_true,

  -- lunch-ready: meal_period_tags contains 'lunch'
  COUNT(*) FILTER (WHERE meal_period_tags @> ARRAY['lunch'])            AS lunch_ready,

  -- dinner-ready: meal_period_tags contains 'dinner'
  COUNT(*) FILTER (WHERE meal_period_tags @> ARRAY['dinner'])           AS dinner_ready,

  -- fully-ready: has all V2 filter fields populated
  COUNT(*) FILTER (
    WHERE lat IS NOT NULL
      AND lng IS NOT NULL
      AND budget_per_person_max_yen IS NOT NULL
      AND party_size_tags IS NOT NULL
      AND atmosphere_tags IS NOT NULL
      AND walk_in_available IS NOT NULL
      AND parking_available IS NOT NULL
      AND meal_period_tags IS NOT NULL
      AND business_hours_known = true
  )                                                                     AS fully_ready

FROM public.restaurants;

-- ============================================================
-- 3. Systematic-zero filter detection
--    Reports any filter where ALL restaurants have NULL (guaranteed 0 results)
-- ============================================================

SELECT
  filter_name,
  CASE WHEN ready_count = 0 THEN 'RELEASE BLOCKER — ALL NULL' ELSE 'OK' END AS status,
  ready_count,
  total
FROM (
  SELECT 'distance (lat+lng)'        AS filter_name,
    COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS ready_count,
    COUNT(*) AS total FROM public.restaurants
  UNION ALL
  SELECT 'budget_per_person_max_yen',
    COUNT(*) FILTER (WHERE budget_per_person_max_yen IS NOT NULL),
    COUNT(*) FROM public.restaurants
  UNION ALL
  SELECT 'party_size_tags',
    COUNT(*) FILTER (WHERE party_size_tags IS NOT NULL),
    COUNT(*) FROM public.restaurants
  UNION ALL
  SELECT 'atmosphere_tags',
    COUNT(*) FILTER (WHERE atmosphere_tags IS NOT NULL),
    COUNT(*) FROM public.restaurants
  UNION ALL
  SELECT 'walk_in_available=true',
    COUNT(*) FILTER (WHERE walk_in_available IS TRUE),
    COUNT(*) FROM public.restaurants
  UNION ALL
  SELECT 'parking_available=true',
    COUNT(*) FILTER (WHERE parking_available IS TRUE),
    COUNT(*) FROM public.restaurants
  UNION ALL
  SELECT 'meal_period_tags (any)',
    COUNT(*) FILTER (WHERE meal_period_tags IS NOT NULL),
    COUNT(*) FROM public.restaurants
  UNION ALL
  SELECT 'business_hours_known (open_now)',
    COUNT(*) FILTER (WHERE business_hours_known = true),
    COUNT(*) FROM public.restaurants
) t
ORDER BY
  CASE WHEN ready_count = 0 THEN 0 ELSE 1 END,
  filter_name;
