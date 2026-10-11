# FoodKit Local QA Harness

Three deterministic scripts for local development confidence:

| Command | Purpose |
|---|---|
| `npm run qa:reset` | Wipe local DB + seed QA fixtures |
| `npm run qa:smoke` | Run authenticated smoke tests |
| `npm run qa:quality` | Lint + tsc + build sequence |

## Prerequisites

- Local Supabase running: `supabase start`
- `.env.local` present (or default local keys apply automatically)
- Node.js 18+

## qa:reset

Resets the local database from scratch and seeds a deterministic fixture set.

Steps:
1. `supabase db reset --local` — replays all migrations
2. Creates 4 QA auth users via service role
3. Sets preference cards (6 cards per user, configured for similarity testing)
4. Creates 7 review fixtures across 5 restaurants
5. Creates QA Group A with test1 (admin) + test2 (member)
6. Creates test1→test2 and test1→test3 follows
7. Validates all components exist

**LOCAL ONLY.** The script aborts if `NEXT_PUBLIC_SUPABASE_URL` does not point to `127.0.0.1` or `localhost`.

### QA Users

| Username | Email | Role |
|---|---|---|
| test1 | test1@foodkit.local | Primary actor; group admin; follows test2+test3 |
| test2 | test2@foodkit.local | Group member; similar to test1 |
| test3 | test3@foodkit.local | Non-member; similar to test1 |
| outsider | outsider@foodkit.local | No group, no follows, no preference cards |

Password for all QA users: `FoodKitTest123!`

### Preference Card Similarity

| Pair | Intersection | Jaccard | Similar? |
|---|---|---|---|
| test1 ↔ test2 | 5/7 | 0.71 | ✓ |
| test1 ↔ test3 | 4/8 | 0.50 | ✓ |
| test2 ↔ test3 | 3/9 | 0.33 | ✗ |

## qa:smoke

Runs ~75 authenticated API-level tests across 18 sections.

Each test prints `PASS`, `FAIL`, or `SKIP` with a test ID. Exit code 1 if any test fails.

Sections:
- **AUTH** — login, wrong password, identity
- **ONBOARD** — new user flow, set_my_preference_cards validation
- **PROFILE** — own/other profile reads, RLS isolation, name update
- **USERNAME** — rename, uniqueness, rollback
- **REVIEWS** — CRUD, rating constraints, RLS isolation
- **STORAGE** — bucket visibility checks (browser-upload tests SKIPped)
- **FOLLOW** — insert, duplicate rejection, unfollow, remove_follower RPC, RLS
- **NOTIF** — trigger fires on follow+review INSERT (not UPDATE), RLS, mark-read RPCs
- **GROUP** — member access, invite code join, non-member exclusion
- **GROUPREC** — get_group_recommendations_v2, budget/parking filters, outsider exclusion
- **PERSONAL** — get_personal_recommendations_v2, follow/similar evidence, own exclusion, data safety
- **FOLLOWREC** — followed user records, order, self-exclusion
- **TODAY** — get_today_restaurants with various filter combinations
- **HOURS** — business hours data checks (time-dependent test SKIPped)
- **TABS** — get_restaurant_reviews_v2 all/similar/following scopes
- **MYREC** — own reviews sort/filter, isolation
- **SEC** — cross-user mutation attempts, email/key leak checks
- **PASSWORD** — wrong password, update, old invalidated, new valid

Run after `qa:reset` to ensure a clean fixture state.

## qa:quality

Runs the three gate checks in sequence:

```
lint  →  tsc  →  build
```

Exits 0 only if all three pass. Used as the final gate before committing.

## Safety Guards

- `guardLocal()` aborts the process if `NEXT_PUBLIC_SUPABASE_URL` is not `127.0.0.1`/`localhost`
- No new migrations are created by these scripts
- No production Supabase touched
- Service role key used only for fixture seeding (never in smoke test assertions)
- No secrets written to source files — standard local demo keys only (publicly documented)
