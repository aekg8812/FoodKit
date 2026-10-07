# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server (Next.js 16 + Turbopack, http://localhost:3000)
npm run build        # Production build (required before committing)
npm run lint         # ESLint (must pass with 0 errors before commit)
npx tsc --noEmit     # Type-check without emitting (run after lint)

supabase start                    # Start local Supabase stack
supabase db reset --local         # Wipe local DB and replay all migrations from scratch
supabase migration list           # Show local vs remote migration status
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres   # Direct DB access for runtime SQL tests
```

There are no automated tests. Correctness is verified by `npm run build`, `npx tsc --noEmit`, and manual runtime SQL tests via psql.

## Branch policy

Current development branch: `feature/v2-development`

- Before starting any autonomous milestone work, verify: `git branch --show-current` → must be `feature/v2-development`
- Do not commit directly to `main`
- Do not merge `main` during autonomous milestone work
- Do not force push
- Do not push to remote unless explicitly instructed
- Never lose local commits
- Production deploy is prohibited

`main` currently also contains the V2 commits. Do not reset or reorganize branches without explicit instruction — continue all development on `feature/v2-development`.

## Production operations — prohibited during development

Do not execute any of the following without explicit instruction:

- `supabase db push` (production DB migration)
- Any production DB modification or seed
- Vercel production deploy
- Merging into `main`
- Force push

Use local Supabase only.

## Autonomous Milestone Mode

Within an approved milestone, proceed without stopping for approval after each small batch:

```
inspect → plan internally → implement → self-review
→ runtime test → lint → typecheck → build → commit → next batch
```

**STOP and report** only when:
- An unapproved RLS change is required
- Auth or Storage security redesign is needed
- A destructive schema change is required
- An existing migration file would need editing
- An external API or new npm dependency is required
- A production operation is required
- A security decision needs human judgment
- Local DB is unavailable for required runtime tests
- A fix fails after 3 repair attempts
- A confirmed V2 specification is in conflict

## Architecture

### App name: FoodKit

Mobile-first (375 px) restaurant review app. Users onboard, register restaurants, post reviews, and see recommendations from people with similar food preferences.

### Next.js 16 App Router conventions

- **Server Components** (`page.tsx`, `layout.tsx`): `params` and `searchParams` are `Promise<…>` — always `await` them.
- **Client Components** (`'use client'`): use `useParams()`, `useSearchParams()`, `useRouter()` from `next/navigation`. Do not pass Promise props to client components; unwrap on the server side first.
- `src/proxy.ts` is the Next.js middleware; it refreshes Supabase sessions on every request.
- Client Components that use `useSearchParams()` must be wrapped in `<Suspense>` at their call site.

### Supabase integration

Two clients, never mixed:
- `src/lib/supabase/server.ts` — async `createClient()`, for Server Components (uses `@supabase/ssr` + `cookies()`).
- `src/lib/supabase/client.ts` — sync `createClient()`, for Client Components (uses `createBrowserClient`).

### Auth and onboarding guard

Protected V2 application pages normally follow this pattern:

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
const state = await getUserState(supabase, user)
if (state === 'no_onboarding') redirect('/onboarding')
```

**Exceptions — do not apply this guard mechanically to:**
- `/onboarding`, `/onboarding/preferences` — these are the onboarding flow itself
- `/login`, `/signup` — auth routes
- Any route that is part of the auth/onboarding entry path

Applying the guard to the onboarding route will cause a redirect loop.

`getUserState` (`src/lib/auth/getUserState.ts`) reads `users.onboarding_completed`. The `/onboarding` page routes V2 users (`onboarding_version = 2`) to `/onboarding/preferences` for preference-card selection.

### Database / RLS model

- **RLS is always on.** Never bypass with `service_role` from client code.
- **`user_public_profiles`**: Use this view for all other-user lookups. `SELECT *` on `users` is prohibited. Never return `email` or other private columns to other users. Before modifying this view's security mode, check the live definition via `pg_class`, `reloptions`, or `pg_get_viewdef` — do not infer or change security mode from memory.
- **`restaurant_accesses`** is the visibility control table — not a `group_id` column on restaurants.
- Reviews are always written with `visibility='private', group_id=null`. The read policy (`reviews_select_relational`) delegates to `can_view_review()`, which in V2 returns `auth.uid() IS NOT NULL`.
- **`review-images` Storage bucket is private.** Signed URLs may be generated server-side (Server Components) or via the authenticated browser client (client-fetched lists), provided Storage RLS is respected. Never make the bucket public, store signed URLs in DB, or use `service_role` to bypass Storage RLS. Current TTL: 1 hour.
- **`avatars` bucket is public** — use `getPublicUrl()`.

### Security-definer RPC contract

All security-definer RPCs must:
- Set `search_path = public, pg_temp`
- `REVOKE` from `public`
- `GRANT EXECUTE` to `authenticated` only
- Guard `auth.uid() IS NULL` → return empty result set or raise

### Migration workflow

Before creating any new migration, run `supabase migration list` to determine the correct next timestamp — do not infer it from filenames in the repository. Never edit existing migration files. After adding migrations, run `supabase db reset --local` to verify the full chain applies cleanly from zero.

### Follow system

- `src/lib/follows/mutations.ts` exports `followUser` and `unfollowUser` — reuse these everywhere.
- `follows` table: `follower_id → followee_id`, `status = 'accepted'`. RLS allows SELECT only for rows involving `auth.uid()`.
- Other-user follow counts require a security-definer RPC because the self-only RLS prevents direct counting.
- `remove_follower` (incoming-edge deletion by the followee) also requires a security-definer RPC because the standard DELETE policy is restricted to `follower_id = auth.uid()`.

### Key shared components

| Component | Notes |
|---|---|
| `BackButton` | Client Component: `router.back()` + `fallbackHref`. Wrap in `<Suspense>`. |
| `ReviewCard` | Renders a review with avatar, rating, comment, signed image. |
| `ReviewTabsNav` | Tab bar (みんな / 好みが近い人 / フォロー中); updates `?reviewTab=` param. |
| `ShareButton` | `navigator.share()` with `window.location.href` fallback. |
| `ProfileLayout` | **V1 legacy component.** Full-page profile layout (avatar, name, friend count, value type, review grid). V2 profile pages may need to extend or partially replace this. Do not treat its current output as final V2 specification. |
| `ProfileActions` | Follow/unfollow buttons; uses `router.refresh()` after mutation. |
| `BottomSheet` | `<dialog>`-based bottom sheet for confirmations and menus. |
| `RatingBadge` / `RATING_LABELS` | 1–4 rating display. |
| `BottomNav` | **Current implementation is a legacy 3-tab nav** (ホーム / 友人・グループ / マイページ). V2 target spec is 5 tabs: ホーム / 検索 / 記録 / グループ / マイページ. Do not partially migrate BottomNav until all target routes exist. |

### URL state conventions

- `?reviewTab=all|similar|following` — invalid → `all`
- `?sort=newest|oldest` — invalid → `newest`
- `?tab=following|followers` — follow list pages
- `?q=` — search query, URL-persisted
- Never pass `returnUrl` or arbitrary redirect targets as query params — use `router.back()` with a safe `fallbackHref`.

### V2 preference cards

`user_preference_cards` has self-only RLS — do not relax it. To expose another user's preference information for UI display, use a security-definer RPC that returns only display-safe fields: `label`, `description`, `image_path`, `sort_order`. Do not expose:

- Raw `user_preference_cards` rows
- Stable internal keys (unless required by UI)
- Email or other private profile data

"好みが近い人" similarity: `intersection ≥ 3` AND `intersection / union ≥ 0.40`, both users must have `≥ 5` V2 cards. Computed server-side only — never return another user's card keys to the client.

### V1 legacy assets

The following exist from V1 and should not be treated as V2 targets:

- `ProfileLayout` — see above
- `friends/` routes — V1 friend model (mutual-follow = "友人")
- `main_value_type` in `user_value_profiles` — V1 value classification; V2 uses preference cards instead
- 3-tab `BottomNav` — see above
