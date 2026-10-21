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

## Quick Start

```bash
supabase start
npm run qa:reset
npm run qa:smoke
npm run qa:quality
```

## qa:reset

Resets the local database from scratch and seeds a deterministic fixture set.

Steps:
1. `supabase db reset --local` — replays all 46 migrations
2. Creates 4 QA auth users via service role
3. Sets preference cards (6 cards per user, configured for similarity testing)
4. Creates 7 review fixtures across 5 restaurants
5. Creates QA Group A with test1 (owner) + test2 (member), with restaurant access grant
6. Creates test1→test2 and test1→test3 follows
7. Validates all components exist

**LOCAL ONLY.** The script aborts if `NEXT_PUBLIC_SUPABASE_URL` does not point to `127.0.0.1` or `localhost`.

Run `qa:reset` again at any time to return to the clean fixture state.

### QA Users (LOCAL CREDENTIALS ONLY — never use in production)

| Username | Email | Password | Role |
|---|---|---|---|
| test1 | test1@foodkit.local | FoodKitTest123! | Primary actor; group owner; follows test2+test3 |
| test2 | test2@foodkit.local | FoodKitTest123! | Group member; similar preference to test1 |
| test3 | test3@foodkit.local | FoodKitTest123! | Non-group member; similar preference to test1 |
| outsider | outsider@foodkit.local | FoodKitTest123! | No group, no follows, no preference cards |

### Preference Card Similarity

| Pair | Intersection | Jaccard | Similar? |
|---|---|---|---|
| test1 ↔ test2 | 5/7 | 0.71 | ✓ |
| test1 ↔ test3 | 4/8 | 0.50 | ✓ |
| test2 ↔ test3 | 3/9 | 0.33 | ✗ |

## Browse Fixture Data in the App

After `qa:reset`, you can use the fixture data in the running FoodKit UI:

```bash
npm run qa:reset
npm run dev
```

Then open `http://localhost:3000` and log in as:

- Email: `test1@foodkit.local`
- Password: `FoodKitTest123!`

Expected state for test1:
- `/home` — onboarding complete; おすすめ表示（follows test2+test3、similarity cards設定済み）
- `/mypage` — 3件の記録、6枚の好みカード
- `/groups` — QA Group A（test2もメンバー）
- `/mypage/follows` — test2/test3をフォロー中

## qa:smoke

Runs ~100 authenticated API-level tests across 18 sections.

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
- **GROUPREC** — get_group_recommendations_v2, budget/parking filters, 0-valid-member behavior, outsider exclusion
- **PERSONAL** — get_personal_recommendations_v2, follow/similar evidence, own exclusion, data safety
- **FOLLOWREC** — followed user records, order, self-exclusion
- **TODAY** — get_today_restaurants with various filter combinations
- **HOURS** — business hours data checks (time-dependent `open_now` test SKIPped)
- **TABS** — get_restaurant_reviews_v2 all/similar/following scopes
- **MYREC** — own reviews sort/filter, isolation
- **SEC** — cross-user mutation attempts, email/key leak checks
- **PASSWORD** — wrong password, update, old invalidated, new valid

### Post-smoke State

`qa:smoke` performs cleanup for each mutating scenario (follow/unfollow, username rename, name change, temp users created/deleted). The base fixture is preserved after smoke runs.

If you plan to use the fixture data in the browser after running `qa:smoke`, the fixture is intact. However, if a test fails mid-cleanup, run `npm run qa:reset` to fully restore the initial state.

### SKIPped Tests (manual browser QA)

| ID | Reason |
|---|---|
| STORAGE-01 | review image signed URL requires browser file upload |
| STORAGE-02 | avatar public URL requires browser file upload |
| HOURS-03 | `p_open_now` result depends on current time — verify manually at known open/closed times |

## qa:quality

Runs the three gate checks in sequence:

```
lint  →  tsc  →  build
```

Exits 0 only if all three pass. Used as the final gate before committing.

## Manual Browser QA Checklist

The following cannot be automated without a browser and should be verified manually:

- [ ] 375px viewport — all pages visual fidelity
- [ ] Actual tap targets and scrolling
- [ ] Avatar image upload (camera/file picker)
- [ ] Review image upload and signed URL display
- [ ] PKCE password recovery email link (click from Inbucket: http://127.0.0.1:54324)
- [ ] Browser Back navigation state
- [ ] Geolocation permission prompt
- [ ] Keyboard input on mobile

## Safety Guards

- `guardLocal()` aborts the process if `NEXT_PUBLIC_SUPABASE_URL` is not `http://127.0.0.1:*` or `http://localhost:*`
- Remote/production Supabase URLs are rejected before any DB operation
- No migrations created or modified by these scripts
- No production Supabase ever touched
- Service role used only for fixture seeding/cleanup (never in smoke test assertions)
- Local demo keys hardcoded (same for all local Supabase instances, publicly documented by Supabase)
- QA credentials (`FoodKitTest123!`) must never be used on production

## Architecture

```
scripts/qa/
  _lib/
    env.mjs       — local guard, Supabase client factories, loadEnv
    assert.mjs    — Runner class (PASS/FAIL/SKIP counter, section grouping)
    seed.mjs      — fixture creation helpers (service role only)
  reset.mjs       — orchestrate: guard → db reset → seed → validate
  smoke.mjs       — 100 authenticated smoke tests
  quality.mjs     — lint + tsc + build
docs/
  QA_HARNESS.md   — this file
```
