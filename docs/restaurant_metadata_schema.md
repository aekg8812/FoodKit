# Restaurant Metadata Schema Reference

Source of truth: `public.restaurants` table (confirmed via `\d public.restaurants`).
All field names and allowed values are enforced by CHECK constraints — do NOT deviate.

---

## Fields requiring human verification

### `lat` / `lng`
- Type: `double precision` (nullable)
- Constraints: `lat` in [-90, 90], `lng` in [-180, 180]
- Usage: distance filter in `get_group_recommendations_v2` via `haversine_km()`
- NULL semantics: NULL = distance filter always passes (restaurant included regardless of distance)
- Format: decimal degrees, e.g. `33.6345` / `130.6942`

### `budget_per_person_max_yen`
- Type: `integer` (nullable)
- Constraint: must be > 0
- Usage: `p_budget_max` filter — `r.budget_per_person_max_yen <= p_budget_max`
- NULL semantics: NULL = restaurant passes budget filter only when `p_budget_max IS NULL`
- Format: integer yen, e.g. `1500` (¥1,500/person)

### `party_size_tags`
- Type: `text[]` (nullable, GIN-indexed)
- Allowed values (exhaustive, enforced by CHECK):
  - `solo`
  - `pair`
  - `small_group`
  - `large_group`
- Usage: `r.party_size_tags @> array[p_party_tag]`
- NULL semantics: NULL = restaurant passes party filter only when `p_party_tag IS NULL`
- Format CSV column: pipe-separated, e.g. `solo|pair`

### `atmosphere_tags`
- Type: `text[]` (nullable, GIN-indexed)
- Allowed values (exhaustive, enforced by CHECK):
  - `lively`
  - `relaxed`
  - `casual`
- Usage: `r.atmosphere_tags @> array[p_atmosphere_tag]`
- NULL semantics: NULL = restaurant passes vibe filter only when `p_atmosphere_tag IS NULL`
- Format CSV column: pipe-separated, e.g. `casual|relaxed`

### `walk_in_available`
- Type: `boolean` (nullable)
- Usage: `not coalesce(p_walk_in, false) OR r.walk_in_available IS TRUE`
- NULL semantics: NULL = restaurant BLOCKED when `p_walk_in = true` (NULL is not TRUE)
- Format: `true` / `false`

### `parking_available`
- Type: `boolean` (nullable)
- Usage: `not coalesce(p_parking, false) OR r.parking_available IS TRUE`
- NULL semantics: NULL = restaurant BLOCKED when `p_parking = true`
- Format: `true` / `false`

### `meal_period_tags`
- Type: `text[]` (nullable, GIN-indexed)
- Allowed values (exhaustive, enforced by CHECK):
  - `lunch`
  - `dinner`
- Usage: `r.meal_period_tags @> array[p_meal_period]`
- NULL semantics: NULL = restaurant BLOCKED when `p_meal_period IS NOT NULL`
- Format CSV column: pipe-separated, e.g. `lunch|dinner`

### `business_hours_known`
- Type: `boolean` NOT NULL, default `false`
- Meaning: `true` = rows exist in `restaurant_business_hours`; `false` = hours unknown
- Must be set to `true` when inserting rows into `restaurant_business_hours`

### `restaurant_business_hours` rows
- Separate table, keyed by `restaurant_id`
- `day_of_week`: `smallint` 0=Sunday … 6=Saturday
- `opens_at` / `closes_at`: `time` (HH:MM:SS), 24-hour
- `closes_next_day`: `boolean` — set `true` when closes after midnight (e.g. bar 25:00 = 01:00 next day)
- Constraint: if `closes_next_day=false` then `opens_at < closes_at`; if `true` then `closes_at < opens_at`
- Usage: `open_now` filter in `get_group_recommendations_v2` checks current time against these rows

---

## Fields already populated (no action needed)

| Field | Status |
|---|---|
| `name` | 53/53 |
| `area` | 53/53 |
| `genre` | 53/53 |
| `id` | 53/53 |

---

## Legacy / V1 fields (do not modify)

| Field | Notes |
|---|---|
| `budget_range` | V1 text enum (`low`/`mid`/`high`). Used by `get_recommendations_filtered` (V1 RPC). Not used in V2 UI. |
| `party_size_note` | V1 free-text. Not used in V2. |
| `memo` | Internal notes. Not displayed in V2. |
| `source` | `manual` / `seed`. Do not change. |
| `external_place_id` | Reserved for future Google Places integration. Leave NULL. |
