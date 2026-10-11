import { QA_PASSWORD } from './env.mjs'

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
  const created = {}
  for (const u of QA_USERS) {
    // Clean up any previous partial run for this username
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('username', u.username)
      .maybeSingle()
    if (existing) {
      await admin.auth.admin.deleteUser(existing.id)
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: { name: u.name, username: u.username },
    })
    if (error) throw new Error(`createUser ${u.username}: ${error.message}`)
    created[u.username] = data.user.id
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
    const { error: insertErr } = await admin.from('user_preference_cards').insert(rows)
    if (insertErr) throw new Error(`preference_cards insert for ${username}: ${insertErr.message}`)
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
  // test1→test2, test1→test3 (trigger fires, notifications created — OK for fixture)
  const { error } = await admin.from('follows').insert([
    { follower_id: userIds.test1, followee_id: userIds.test2, status: 'accepted' },
    { follower_id: userIds.test1, followee_id: userIds.test3, status: 'accepted' },
  ])
  if (error) throw new Error(`follows insert: ${error.message}`)
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
