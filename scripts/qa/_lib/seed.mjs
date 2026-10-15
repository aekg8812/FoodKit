import { QA_PASSWORD } from './env.mjs'

// Minimal valid 1×1 transparent webp (base64) — used to seed restaurant main images
// without committing binary files to git.
export const MINIMAL_WEBP_BASE64 =
  'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoBAAEAAkA4JYgCdAEO/gHOAAD++P/////+wAAAAA=='

export async function uploadRestaurantMainImage(admin, restaurantId) {
  const imageBytes = Buffer.from(MINIMAL_WEBP_BASE64, 'base64')
  const path = `${restaurantId}/qa-fixture.webp`
  // Remove any existing fixture image first (idempotent reset)
  await admin.storage.from('restaurant-images').remove([path])
  const { error: uploadErr } = await admin.storage
    .from('restaurant-images')
    .upload(path, imageBytes, { contentType: 'image/webp' })
  if (uploadErr) throw new Error(`restaurant image upload for ${restaurantId}: ${uploadErr.message}`)
  const { error: updateErr } = await admin
    .from('restaurants')
    .update({ main_image_path: path })
    .eq('id', restaurantId)
  if (updateErr) throw new Error(`restaurant main_image_path update for ${restaurantId}: ${updateErr.message}`)
  return path
}

// Preference card keys per user
// Similarity vs test1: test2 Jaccard=5/7≈0.71, test3 Jaccard=4/8=0.50 — both ≥0.40 and intersection≥3
export const CARD_KEYS = {
  test1: ['cost_conscious', 'local_discovery', 'hearty_meal', 'good_reputation', 'lively_atmosphere', 'friends_friendly'],
  test2: ['cost_conscious', 'local_discovery', 'hearty_meal', 'good_reputation', 'lively_atmosphere', 'solo_friendly'],
  test3: ['cost_conscious', 'local_discovery', 'hearty_meal', 'lively_atmosphere', 'quiet_atmosphere', 'taste_focused'],
}

export const QA_USERS = [
  { email: 'test1@foodkit.local', username: 'test1', name: 'テストユーザー1', cards: 'test1' },
  { email: 'test2@foodkit.local', username: 'test2', name: 'テストユーザー2', cards: 'test2' },
  { email: 'test3@foodkit.local', username: 'test3', name: 'テストユーザー3', cards: 'test3' },
  { email: 'outsider@foodkit.local', username: 'outsider', name: 'アウトサイダー', cards: null },
]

// Fixed UUIDs — must match seed.sql. Stable across db resets.
export const QA_USER_IDS = {
  test1:    'cccccccc-0000-0000-0000-000000000001',
  test2:    'cccccccc-0000-0000-0000-000000000002',
  test3:    'cccccccc-0000-0000-0000-000000000003',
  outsider: 'cccccccc-0000-0000-0000-000000000004',
}

// Reviews looked up by restaurant name at runtime — no hardcoded IDs
export const REVIEW_FIXTURES = [
  { username: 'test1', restaurantName: 'すき家 飯塚市役所前店', rating: 4, comment: 'QA: test1 review A' },
  { username: 'test1', restaurantName: '中華料理 鴻福家',       rating: 2, comment: 'QA: test1 review B' },
  { username: 'test1', restaurantName: 'かっちゃんラーメン',    rating: 3, comment: 'QA: test1 review C' },
  { username: 'test2', restaurantName: 'すき家 飯塚市役所前店', rating: 4, comment: 'QA: test2 review A' },
  { username: 'test2', restaurantName: 'かつ丼 豚ジロー',       rating: 3, comment: 'QA: test2 review B' },
  { username: 'test3', restaurantName: 'かっちゃんラーメン',    rating: 4, comment: 'QA: test3 review A' },
  { username: 'test3', restaurantName: 'ラーメン 柳麺亭',       rating: 3, comment: 'QA: test3 review B' },
]

export const GROUP_FIXTURE = {
  name: 'QA Group A',
  invite_code: 'QA-INVITE-2026',
}

export async function createQAUsers(admin) {
  // seed.sql already created these users with fixed UUIDs on db reset.
  // Verify each exists; if somehow absent (edge case), create with the fixed UUID.
  const created = {}
  for (const u of QA_USERS) {
    const fixedId = QA_USER_IDS[u.username]
    const { data: { user: existing } } = await admin.auth.admin.getUserById(fixedId)
    if (existing) {
      created[u.username] = fixedId
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        id: fixedId,
        email: u.email,
        password: QA_PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.name, username: u.username },
      })
      if (error) throw new Error(`createUser ${u.username}: ${error.message}`)
      created[u.username] = data.user.id
    }
  }
  return created
}

export async function setPreferenceCards(admin, userIds) {
  const { data: allCards, error } = await admin.from('preference_cards').select('id, key')
  if (error) throw new Error(`preference_cards lookup: ${error.message}`)
  const keyToId = Object.fromEntries(allCards.map(c => [c.key, c.id]))

  for (const [username, keys] of Object.entries(CARD_KEYS)) {
    const uid = userIds[username]
    if (!uid) continue
    const rows = keys.map(key => ({ user_id: uid, preference_card_id: keyToId[key] }))
    // seed.sql already inserts these; upsert with ignoreDuplicates for idempotency
    const { error: insertErr } = await admin
      .from('user_preference_cards')
      .upsert(rows, { onConflict: 'user_id,preference_card_id', ignoreDuplicates: true })
    if (insertErr) throw new Error(`preference_cards upsert for ${username}: ${insertErr.message}`)
    const { error: updateErr } = await admin
      .from('users')
      .update({ onboarding_completed: true })
      .eq('id', uid)
    if (updateErr) throw new Error(`onboarding_completed update for ${username}: ${updateErr.message}`)
  }
}

export async function createReviews(admin, userIds) {
  const names = [...new Set(REVIEW_FIXTURES.map(r => r.restaurantName))]
  const { data: restaurants, error } = await admin.from('restaurants').select('id, name').in('name', names)
  if (error) throw new Error(`restaurants lookup: ${error.message}`)
  const nameToId = Object.fromEntries(restaurants.map(r => [r.name, r.id]))

  for (const fix of REVIEW_FIXTURES) {
    const rid = nameToId[fix.restaurantName]
    if (!rid) throw new Error(`restaurant not found: ${fix.restaurantName}`)
    const uid = userIds[fix.username]
    if (!uid) throw new Error(`user not found: ${fix.username}`)
    // seed.sql already creates dev reviews; skip if (user_id, restaurant_id) already exists
    const { data: existing } = await admin
      .from('reviews')
      .select('id')
      .eq('user_id', uid)
      .eq('restaurant_id', rid)
      .maybeSingle()
    if (existing) continue
    const { error: insertErr } = await admin.from('reviews').insert({
      user_id: uid,
      restaurant_id: rid,
      rating: fix.rating,
      comment: fix.comment,
      visibility: 'private',
      group_id: null,
      visit_date: '2026-10-01',
    })
    if (insertErr) throw new Error(`review insert ${fix.username}→${fix.restaurantName}: ${insertErr.message}`)
  }
}

export async function createGroup(admin, userIds) {
  // seed.sql already creates QA Group A; return its ID if found
  const { data: existing } = await admin
    .from('groups')
    .select('id')
    .eq('invite_code', GROUP_FIXTURE.invite_code)
    .maybeSingle()
  if (existing) return existing.id

  const { data: group, error } = await admin
    .from('groups')
    .insert({ name: GROUP_FIXTURE.name, invite_code: GROUP_FIXTURE.invite_code, created_by: userIds.test1 })
    .select('id')
    .single()
  if (error) throw new Error(`group create: ${error.message}`)
  const gid = group.id

  // Service role bypasses group_members INSERT RLS
  const { error: memErr } = await admin.from('group_members').insert([
    { group_id: gid, user_id: userIds.test1, role: 'owner' },
    { group_id: gid, user_id: userIds.test2, role: 'member' },
  ])
  if (memErr) throw new Error(`group_members insert: ${memErr.message}`)

  // Grant group access to a notification-test restaurant so authenticated members can INSERT reviews
  const { data: notifRest } = await admin.from('restaurants').select('id').eq('name', '台湾料理 聚豊園').maybeSingle()
  if (notifRest) {
    await admin.from('restaurant_accesses').insert({
      restaurant_id: notifRest.id,
      group_id: gid,
      visibility: 'group',
      created_by: userIds.test1,
    })
  }

  return gid
}

export async function createBaseFollows(admin, userIds) {
  // seed.sql already creates test1→test2, test1→test3, test2→test1 follows.
  // upsert with ignoreDuplicates for idempotency.
  const { error } = await admin.from('follows').upsert(
    [
      { follower_id: userIds.test1, followee_id: userIds.test2, status: 'accepted' },
      { follower_id: userIds.test1, followee_id: userIds.test3, status: 'accepted' },
    ],
    { onConflict: 'follower_id,followee_id', ignoreDuplicates: true },
  )
  if (error) throw new Error(`follows upsert: ${error.message}`)
}

export async function validateFixture(admin, userIds) {
  const errors = []

  for (const username of ['test1', 'test2', 'test3', 'outsider']) {
    if (!userIds[username]) errors.push(`user ${username} missing`)
  }

  for (const [username] of Object.entries(CARD_KEYS)) {
    const { count } = await admin
      .from('user_preference_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userIds[username])
    if ((count ?? 0) < 5) errors.push(`${username} preference cards: ${count} < 5`)
  }

  const { count: revCount } = await admin
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .in('user_id', Object.values(userIds))
  if ((revCount ?? 0) < 7) errors.push(`reviews: ${revCount} < 7`)

  const { data: groups } = await admin.from('groups').select('id').eq('name', GROUP_FIXTURE.name)
  if (!groups || groups.length === 0) errors.push('QA Group A missing')

  const { count: followCount } = await admin
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userIds.test1)
  if ((followCount ?? 0) < 2) errors.push(`test1 follows: ${followCount} < 2`)

  const names = [...new Set(REVIEW_FIXTURES.map(r => r.restaurantName))]
  const { data: rests } = await admin.from('restaurants').select('id').in('name', names)
  if (!rests || rests.length < names.length) {
    errors.push(`restaurants: found ${rests?.length ?? 0} of ${names.length} expected`)
  }

  if (errors.length > 0) throw new Error(`Fixture validation FAILED:\n  ${errors.join('\n  ')}`)

  console.log('  ✓ Fixture validation passed')
  console.log(`    Users: ${Object.keys(userIds).join(', ')}`)
  console.log(`    Reviews: ${revCount}`)
  console.log(`    Group: QA Group A`)
  console.log(`    Follows from test1: ${followCount}`)
}
