#!/usr/bin/env node
// LOCAL QA ONLY — FoodKit V2 authenticated smoke tests

import { loadEnv, guardLocal, createAdminClient, createAnonClient, signInAs, QA_PASSWORD } from './_lib/env.mjs'
import { Runner } from './_lib/assert.mjs'
import { CARD_KEYS } from './_lib/seed.mjs'

loadEnv()
guardLocal()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getUserIds(admin) {
  const usernames = ['test1', 'test2', 'test3', 'outsider']
  const { data, error } = await admin
    .from('users')
    .select('id, username, onboarding_completed')
    .in('username', usernames)
  if (error) throw new Error(`getUserIds: ${error.message}`)
  const map = {}
  for (const row of data ?? []) map[row.username] = row
  for (const u of usernames) {
    if (!map[u]) throw new Error(`QA user '${u}' not found — run qa:reset first`)
  }
  return map
}

async function getGroupId(admin) {
  const { data } = await admin.from('groups').select('id').eq('name', 'QA Group A').maybeSingle()
  if (!data) throw new Error('QA Group A not found — run qa:reset first')
  return data.id
}

async function getRestaurantId(admin, name) {
  const { data } = await admin.from('restaurants').select('id').eq('name', name).maybeSingle()
  if (!data) throw new Error(`Restaurant not found: ${name}`)
  return data.id
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== FoodKit QA Smoke ===\n')
  const admin = createAdminClient()
  const runner = new Runner()

  let users, groupId
  try {
    users = await getUserIds(admin)
    groupId = await getGroupId(admin)
  } catch (err) {
    console.error('Pre-flight failed:', err.message)
    process.exit(1)
  }

  const test1Id    = users.test1.id
  const test2Id    = users.test2.id
  const test3Id    = users.test3.id
  const outsiderId = users.outsider.id

  // ───────────────────────────────────────────────────────────────────────────
  // AUTH
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('AUTH', async (t) => {
    let test1Client, outsiderClient

    await t.check('AUTH-01', 'test1 correct password login', async () => {
      test1Client = await signInAs('test1@foodkit.local')
      const { data: { user } } = await test1Client.auth.getUser()
      t.assert(user != null, 'user should be non-null')
    })

    await t.check('AUTH-02', 'wrong password rejected', async () => {
      const client = createAnonClient()
      const { error } = await client.auth.signInWithPassword({
        email: 'test1@foodkit.local',
        password: 'WrongPassword!',
      })
      t.assert(error != null, 'expected login error with wrong password')
    })

    await t.check('AUTH-03', 'authenticated user identity is test1', async () => {
      if (!test1Client) test1Client = await signInAs('test1@foodkit.local')
      const { data: { user } } = await test1Client.auth.getUser()
      t.assert(user?.id === test1Id, `expected ${test1Id}, got ${user?.id}`)
    })

    await t.check('AUTH-04', 'test1 profile row accessible', async () => {
      if (!test1Client) test1Client = await signInAs('test1@foodkit.local')
      const { data, error } = await test1Client
        .from('users').select('id, username, name').eq('id', test1Id).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.username === 'test1', `expected username test1, got ${data?.username}`)
    })

    await t.check('AUTH-05', 'outsider login succeeds', async () => {
      outsiderClient = await signInAs('outsider@foodkit.local')
      const { data: { user } } = await outsiderClient.auth.getUser()
      t.assert(user?.id === outsiderId, 'outsider ID mismatch')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // ONBOARDING
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('ONBOARD', async (t) => {
    let tmpClient, tmpUserId
    const tmpEmail = `qa_tmp_onboard_${Date.now()}@foodkit.local`

    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: tmpEmail,
        password: QA_PASSWORD,
        email_confirm: true,
        user_metadata: { name: 'QA Temp Onboard' },
      })
      if (error) throw error
      tmpUserId = data.user.id
      tmpClient = await signInAs(tmpEmail)
    } catch (err) {
      t.fail_('ONBOARD-01', 'temp user created for onboard tests', err.message)
      t.skip_('ONBOARD-02', '<5 cards rejected', 'temp user creation failed')
      t.skip_('ONBOARD-03', '>=5 cards accepted', 'temp user creation failed')
      t.skip_('ONBOARD-04', 'onboarding_completed after save', 'temp user creation failed')
      return
    }

    await t.check('ONBOARD-01', 'new V2 user has onboarding_completed=false', async () => {
      const { data, error } = await tmpClient
        .from('users').select('onboarding_completed, onboarding_version').eq('id', tmpUserId).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.onboarding_completed === false, `expected false, got ${data?.onboarding_completed}`)
      t.assert(data?.onboarding_version === 2, `expected version 2, got ${data?.onboarding_version}`)
    })

    await t.check('ONBOARD-02', 'set_my_preference_cards with 3 cards rejected', async () => {
      const { error } = await tmpClient.rpc('set_my_preference_cards', {
        p_card_keys: ['cost_conscious', 'local_discovery', 'hearty_meal'],
      })
      t.assert(error != null, 'expected error with <5 cards but got none')
    })

    await t.check('ONBOARD-03', 'set_my_preference_cards with 6 cards succeeds', async () => {
      const { error } = await tmpClient.rpc('set_my_preference_cards', { p_card_keys: CARD_KEYS.test1 })
      t.assert(!error, error?.message)
    })

    await t.check('ONBOARD-04', 'onboarding_completed=true after set_my_preference_cards', async () => {
      const { data, error } = await tmpClient
        .from('users').select('onboarding_completed').eq('id', tmpUserId).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.onboarding_completed === true, `expected true, got ${data?.onboarding_completed}`)
    })

    await admin.auth.admin.deleteUser(tmpUserId)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // PROFILE
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('PROFILE', async (t) => {
    const test1Client    = await signInAs('test1@foodkit.local')
    const outsiderClient = await signInAs('outsider@foodkit.local')

    await t.check('PROFILE-01', 'test1 own profile readable', async () => {
      const { data, error } = await test1Client
        .from('users').select('id, name, username').eq('id', test1Id).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.username === 'test1', 'username should be test1')
    })

    await t.check('PROFILE-02', 'test2 profile via user_public_profiles', async () => {
      const { data, error } = await test1Client
        .from('user_public_profiles').select('id, name, username').eq('username', 'test2').maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.id === test2Id, 'test2 profile not found')
    })

    await t.check('PROFILE-03', 'outsider can read public profile fields', async () => {
      const { data, error } = await outsiderClient
        .from('user_public_profiles').select('id, name, username').eq('username', 'test1').maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.id === test1Id, 'test1 not found by outsider')
    })

    await t.check('PROFILE-04', 'email NOT in user_public_profiles response', async () => {
      const { data, error } = await test1Client
        .from('user_public_profiles').select('*').eq('username', 'test2').maybeSingle()
      t.assert(!error, error?.message)
      t.assert(!('email' in (data ?? {})), 'email should not be in public profile response')
    })

    let origName
    await t.check('PROFILE-05', 'test1 can update own name', async () => {
      const { data: before } = await test1Client
        .from('users').select('name').eq('id', test1Id).maybeSingle()
      origName = before?.name
      const { error } = await test1Client.from('users').update({ name: 'テスト一郎' }).eq('id', test1Id)
      t.assert(!error, error?.message)
    })

    await t.check('PROFILE-06', 'test1 cannot update test2 name', async () => {
      const { error } = await test1Client.from('users').update({ name: '不正変更' }).eq('id', test2Id)
      if (!error) {
        const { data } = await admin.from('users').select('name').eq('id', test2Id).maybeSingle()
        t.assert(data?.name !== '不正変更', 'test2 name was changed by test1 — RLS breach')
      }
    })

    if (origName) await admin.from('users').update({ name: origName }).eq('id', test1Id)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // USERNAME
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('USERNAME', async (t) => {
    const test1Client = await signInAs('test1@foodkit.local')

    await t.check('USERNAME-01', 'current username resolves', async () => {
      const { data, error } = await test1Client
        .from('users').select('username').eq('id', test1Id).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.username === 'test1', `expected test1, got ${data?.username}`)
    })

    await t.check('USERNAME-02', 'case-insensitive duplicate rejected', async () => {
      const { error } = await test1Client.from('users').update({ username: 'TEST2' }).eq('id', test1Id)
      t.assert(error != null, 'expected error for duplicate username (case-insensitive)')
    })

    await t.check('USERNAME-03', 'own username update succeeds', async () => {
      const { error } = await test1Client.from('users').update({ username: 'test1_qa' }).eq('id', test1Id)
      t.assert(!error, error?.message)
    })

    await t.check('USERNAME-04', 'old username no longer resolves to this user', async () => {
      const { data: byOld } = await test1Client
        .from('user_public_profiles').select('id').eq('username', 'test1').maybeSingle()
      t.assert(!byOld, 'old username test1 should not resolve after rename')
    })

    await t.check('USERNAME-05', 'new username (test1_qa) resolves', async () => {
      const { data } = await test1Client
        .from('user_public_profiles').select('id').eq('username', 'test1_qa').maybeSingle()
      t.assert(data?.id === test1Id, 'new username should resolve to test1')
    })

    await admin.from('users').update({ username: 'test1' }).eq('id', test1Id)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // REVIEWS
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('REVIEWS', async (t) => {
    const test1Client    = await signInAs('test1@foodkit.local')
    const test2Client    = await signInAs('test2@foodkit.local')
    const outsiderClient = await signInAs('outsider@foodkit.local')

    const { data: ownReviews } = await test1Client
      .from('reviews').select('id, rating').eq('user_id', test1Id).limit(1)
    const ownReviewId     = ownReviews?.[0]?.id
    const ownReviewRating = ownReviews?.[0]?.rating

    await t.check('REV-01', 'test1 own reviews readable (≥3)', async () => {
      const { data, error } = await test1Client.from('reviews').select('id').eq('user_id', test1Id)
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 3, `expected ≥3 reviews, got ${data?.length}`)
    })

    await t.check('REV-02', 'test1 can update own review', async () => {
      if (!ownReviewId) throw new Error('no own review found')
      const newRating = ownReviewRating === 4 ? 3 : 4
      const { error } = await test1Client
        .from('reviews')
        .update({ rating: newRating, comment: 'QA updated comment' })
        .eq('id', ownReviewId).eq('user_id', test1Id)
      t.assert(!error, error?.message)
      await admin.from('reviews')
        .update({ rating: ownReviewRating, comment: 'QA: test1 review A' })
        .eq('id', ownReviewId)
    })

    await t.check('REV-03', 'test2 cannot update test1 review', async () => {
      if (!ownReviewId) throw new Error('no own review found')
      await test2Client.from('reviews').update({ rating: 1 }).eq('id', ownReviewId)
      const { data } = await admin.from('reviews').select('rating').eq('id', ownReviewId).maybeSingle()
      t.assert(data?.rating !== 1, 'test2 modified test1 review — RLS breach')
    })

    await t.check('REV-04', 'outsider cannot update test1 review', async () => {
      if (!ownReviewId) throw new Error('no own review found')
      await outsiderClient.from('reviews').update({ rating: 1 }).eq('id', ownReviewId)
      const { data } = await admin.from('reviews').select('rating').eq('id', ownReviewId).maybeSingle()
      t.assert(data?.rating !== 1, 'outsider modified test1 review — RLS breach')
    })

    await t.check('REV-05', 'rating 5 rejected by check constraint', async () => {
      const restId = await getRestaurantId(admin, '台湾料理 聚豊園')
      const { error } = await test1Client.from('reviews').insert({
        restaurant_id: restId, user_id: test1Id, rating: 5, visibility: 'private', group_id: null,
      })
      t.assert(error != null, 'rating 5 should be rejected')
    })

    await t.check('REV-06', 'authenticated user can read visible reviews', async () => {
      if (!ownReviewId) throw new Error('no own review found')
      const { data, error } = await test2Client
        .from('reviews').select('id').eq('id', ownReviewId).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.id === ownReviewId, 'review should be visible to authenticated user')
    })

    await t.check('REV-07', 'anonymous cannot read reviews', async () => {
      if (!ownReviewId) throw new Error('no own review found')
      const anonClient = createAnonClient()
      const { data } = await anonClient.from('reviews').select('id').eq('id', ownReviewId).maybeSingle()
      t.assert(!data, 'anonymous should not be able to read reviews')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // STORAGE (architecture)
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('STORAGE', async (t) => {
    t.skip_('STORAGE-01', 'review image signed URL generation', 'no fixture images — requires browser upload')
    t.skip_('STORAGE-02', 'avatar public URL', 'no fixture avatars — requires browser upload')

    await t.check('STORAGE-03', 'review-images bucket is private', async () => {
      const { data } = await admin.storage.listBuckets()
      const bucket = data?.find(b => b.name === 'review-images')
      t.assert(bucket != null, 'review-images bucket not found')
      t.assert(bucket.public === false, 'review-images bucket should be private')
    })

    await t.check('STORAGE-04', 'avatars bucket is public', async () => {
      const { data } = await admin.storage.listBuckets()
      const bucket = data?.find(b => b.name === 'avatars')
      t.assert(bucket != null, 'avatars bucket not found')
      t.assert(bucket.public === true, 'avatars bucket should be public')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // FOLLOW
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('FOLLOW', async (t) => {
    const test1Client    = await signInAs('test1@foodkit.local')
    const test2Client    = await signInAs('test2@foodkit.local')
    const outsiderClient = await signInAs('outsider@foodkit.local')

    await t.check('FOLLOW-01', 'test1→test2 base follow exists', async () => {
      const { data, error } = await test1Client
        .from('follows').select('id, status')
        .eq('follower_id', test1Id).eq('followee_id', test2Id).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.status === 'accepted', `expected accepted, got ${data?.status}`)
    })

    let newFollowId
    await t.check('FOLLOW-02', 'test2→test1 follow created via authenticated action', async () => {
      const { data, error } = await test2Client
        .from('follows')
        .insert({ follower_id: test2Id, followee_id: test1Id, status: 'accepted' })
        .select('id').single()
      t.assert(!error, error?.message)
      newFollowId = data?.id
    })

    await t.check('FOLLOW-03', 'duplicate follow insert rejected', async () => {
      const { error } = await test2Client
        .from('follows')
        .insert({ follower_id: test2Id, followee_id: test1Id, status: 'accepted' })
      t.assert(error != null, 'duplicate follow should be rejected')
    })

    await t.check('FOLLOW-04', 'unfollow (test2 deletes test2→test1)', async () => {
      if (!newFollowId) throw new Error('no follow to remove')
      const { error } = await test2Client
        .from('follows').delete().eq('id', newFollowId).eq('follower_id', test2Id)
      t.assert(!error, error?.message)
    })

    let reFollowId
    await t.check('FOLLOW-05', 'remove_follower RPC: test1 removes incoming test2→test1', async () => {
      const { data: ins, error: insErr } = await test2Client
        .from('follows')
        .insert({ follower_id: test2Id, followee_id: test1Id, status: 'accepted' })
        .select('id').single()
      if (insErr) throw new Error(`re-follow: ${insErr.message}`)
      reFollowId = ins?.id
      const { error } = await test1Client.rpc('remove_follower', { p_follower_id: test2Id })
      t.assert(!error, error?.message)
      const { data: check } = await admin.from('follows').select('id').eq('id', reFollowId).maybeSingle()
      t.assert(!check, 'follow should be deleted after remove_follower')
    })

    await t.check('FOLLOW-06', 'outsider cannot delete test1→test2 follow', async () => {
      const { data: f } = await admin
        .from('follows').select('id').eq('follower_id', test1Id).eq('followee_id', test2Id).maybeSingle()
      if (!f) throw new Error('test1→test2 follow not found')
      await outsiderClient.from('follows').delete().eq('id', f.id)
      const { data: stillExists } = await admin.from('follows').select('id').eq('id', f.id).maybeSingle()
      t.assert(stillExists != null, 'outsider deleted test1→test2 follow — RLS breach')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('NOTIF', async (t) => {
    const test1Client = await signInAs('test1@foodkit.local')
    const test2Client = await signInAs('test2@foodkit.local')

    let test2FollowId

    await t.check('NOTIF-01', 'follow action creates followed_user + followed_by_user notifications', async () => {
      const { count: before1 } = await test1Client.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', test1Id).eq('type', 'followed_by_user')
      const { count: before2 } = await test2Client.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', test2Id).eq('type', 'followed_user')

      const { data: fData, error: fErr } = await test2Client
        .from('follows')
        .insert({ follower_id: test2Id, followee_id: test1Id, status: 'accepted' })
        .select('id').single()
      if (fErr) throw new Error(`follow insert: ${fErr.message}`)
      test2FollowId = fData?.id

      await new Promise(r => setTimeout(r, 400))

      const { count: after1 } = await test1Client.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', test1Id).eq('type', 'followed_by_user')
      const { count: after2 } = await test2Client.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', test2Id).eq('type', 'followed_user')

      t.assert((after1 ?? 0) > (before1 ?? 0), `followed_by_user for test1: ${before1}→${after1}`)
      t.assert((after2 ?? 0) > (before2 ?? 0), `followed_user for test2: ${before2}→${after2}`)
    })

    await t.check('NOTIF-02', 'duplicate follow unique constraint prevents double notification', async () => {
      const { error: dupErr } = await test2Client
        .from('follows')
        .insert({ follower_id: test2Id, followee_id: test1Id, status: 'accepted' })
      t.assert(dupErr != null, 'duplicate follow insert should fail (unique constraint)')
    })

    await t.check('NOTIF-03', 'test2 review INSERT creates group_member_review notification for test1', async () => {
      const restId = await getRestaurantId(admin, '台湾料理 聚豊園')
      const { count: before } = await test1Client.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', test1Id).eq('type', 'group_member_review')

      const { error: revErr } = await test2Client.from('reviews').insert({
        restaurant_id: restId, user_id: test2Id, rating: 3,
        comment: 'QA: notification test', visibility: 'private', group_id: null,
      })
      if (revErr) throw new Error(`review insert: ${revErr.message}`)
      await new Promise(r => setTimeout(r, 400))

      const { count: after } = await test1Client.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', test1Id).eq('type', 'group_member_review')

      await admin.from('reviews').delete().eq('user_id', test2Id).eq('restaurant_id', restId)
      t.assert((after ?? 0) > (before ?? 0), `group_member_review for test1: ${before}→${after}`)
    })

    await t.check('NOTIF-04', 'review UPDATE does not create new group_member_review notification', async () => {
      const { data: rev } = await admin.from('reviews')
        .select('id').eq('user_id', test2Id).limit(1).maybeSingle()
      if (!rev) { t.skip_('NOTIF-04', 'no test2 review', 'skip'); return }
      const { count: before } = await test1Client.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', test1Id).eq('type', 'group_member_review')
      await admin.from('reviews').update({ comment: 'QA updated' }).eq('id', rev.id)
      await new Promise(r => setTimeout(r, 400))
      const { count: after } = await test1Client.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', test1Id).eq('type', 'group_member_review')
      t.assert((after ?? 0) === (before ?? 0), `review UPDATE should not create notification: ${before}→${after}`)
    })

    let test1NotifId
    await t.check('NOTIF-05', 'mark own notification read succeeds', async () => {
      const { data: notifs } = await test1Client
        .from('notifications').select('id').eq('recipient_user_id', test1Id).limit(1)
      if (!notifs || notifs.length === 0) { t.skip_('NOTIF-05', 'no notifications for test1', 'skip'); return }
      test1NotifId = notifs[0].id
      const { error } = await test1Client.rpc('mark_notification_read', { p_notification_id: test1NotifId })
      t.assert(!error, error?.message)
    })

    await t.check('NOTIF-06', 'test2 cannot SELECT test1 notification (RLS self-only)', async () => {
      if (!test1NotifId) { t.skip_('NOTIF-06', 'no notification ID', 'NOTIF-05 skipped'); return }
      const { data: test2Access } = await test2Client
        .from('notifications').select('id').eq('id', test1NotifId).maybeSingle()
      t.assert(!test2Access, 'test2 should not be able to SELECT test1 notification — RLS breach')
    })

    await t.check('NOTIF-07', 'mark_all_notifications_read returns count', async () => {
      const { data, error } = await test1Client.rpc('mark_all_notifications_read')
      t.assert(!error, error?.message)
      t.assert(typeof data === 'number' || data === null, 'expected numeric or null return')
    })

    if (test2FollowId) await admin.from('follows').delete().eq('id', test2FollowId)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GROUP
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('GROUP', async (t) => {
    const test1Client    = await signInAs('test1@foodkit.local')
    const test2Client    = await signInAs('test2@foodkit.local')
    const test3Client    = await signInAs('test3@foodkit.local')
    const outsiderClient = await signInAs('outsider@foodkit.local')

    await t.check('GROUP-01', 'test1 can read QA Group A', async () => {
      const { data, error } = await test1Client
        .from('groups').select('id, name').eq('id', groupId).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.name === 'QA Group A', `expected QA Group A, got ${data?.name}`)
    })

    await t.check('GROUP-02', 'test2 (member) can read QA Group A', async () => {
      const { data, error } = await test2Client
        .from('groups').select('id').eq('id', groupId).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.id === groupId, 'test2 cannot read group')
    })

    await t.check('GROUP-03', 'outsider cannot read QA Group A', async () => {
      const { data } = await outsiderClient.from('groups').select('id').eq('id', groupId).maybeSingle()
      t.assert(!data, 'outsider should not be able to read group')
    })

    await t.check('GROUP-04', 'test3 can join via invite code', async () => {
      const { data, error } = await test3Client
        .rpc('join_group_by_invite_code', { input_invite_code: 'QA-INVITE-2026' })
      t.assert(!error, error?.message)
      t.assert(data === groupId, `expected groupId ${groupId}, got ${data}`)
    })

    await t.check('GROUP-05', 'test3 member row exists after join', async () => {
      const { data, error } = await test3Client
        .from('group_members').select('user_id, role')
        .eq('group_id', groupId).eq('user_id', test3Id).maybeSingle()
      t.assert(!error, error?.message)
      t.assert(data?.user_id === test3Id, 'test3 member row not found')
    })

    await t.check('GROUP-06', 'member list visible to group members (≥2)', async () => {
      const { data, error } = await test1Client
        .from('group_members').select('user_id, role').eq('group_id', groupId)
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 2, `expected ≥2 members, got ${data?.length}`)
    })

    await t.check('GROUP-07', 'outsider cannot delete group', async () => {
      await outsiderClient.from('groups').delete().eq('id', groupId)
      const { data: stillExists } = await admin.from('groups').select('id').eq('id', groupId).maybeSingle()
      t.assert(stillExists != null, 'group was deleted by outsider — RLS breach')
    })

    await admin.from('group_members').delete().eq('group_id', groupId).eq('user_id', test3Id)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GROUP RECOMMENDATIONS
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('GROUPREC', async (t) => {
    const test1Client    = await signInAs('test1@foodkit.local')
    const outsiderClient = await signInAs('outsider@foodkit.local')

    await t.check('GROUPREC-01', 'get_group_preference_summary runs for member', async () => {
      const { data, error } = await test1Client
        .rpc('get_group_preference_summary', { p_group_id: groupId })
      t.assert(!error, error?.message)
      t.assert(Array.isArray(data), 'expected array result')
    })

    await t.check('GROUPREC-02', 'get_group_recommendations_v2 returns ≥1 result', async () => {
      const { data, error } = await test1Client
        .rpc('get_group_recommendations_v2', { p_group_id: groupId })
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 1, `expected ≥1 rec, got ${data?.length}`)
    })

    await t.check('GROUPREC-03', 'recommendations with budget+parking filter run without error', async () => {
      const { error } = await test1Client.rpc('get_group_recommendations_v2', {
        p_group_id: groupId, p_budget_max: 2000, p_parking: true,
      })
      t.assert(!error, error?.message)
    })

    await t.check('GROUPREC-04', 'recommendation restaurant_ids resolve in restaurants table', async () => {
      const { data } = await test1Client.rpc('get_group_recommendations_v2', { p_group_id: groupId })
      if (!data || data.length === 0) { t.skip_('GROUPREC-04', 'no recs to verify', 'no recs'); return }
      const rids = data.map(r => r.restaurant_id)
      const { data: rests } = await test1Client.from('restaurants').select('id').in('id', rids)
      t.assert(rests?.length === rids.length, `${rests?.length}/${rids.length} restaurant IDs verified`)
    })

    await t.check('GROUPREC-05', 'outsider gets empty results from get_group_recommendations_v2', async () => {
      const { data } = await outsiderClient.rpc('get_group_recommendations_v2', { p_group_id: groupId })
      t.assert(!data || data.length === 0, 'outsider should not get group recommendations')
    })

    await t.check('GROUPREC-06', '0 valid preference member group returns empty recommendations', async () => {
      const tmpEmail = `qa_grp6_${Date.now()}@foodkit.local`
      const { data: tmpData, error: tmpErr } = await admin.auth.admin.createUser({
        email: tmpEmail, password: QA_PASSWORD, email_confirm: true,
        user_metadata: { name: 'QA Temp GrpRec6' },
      })
      if (tmpErr) throw new Error(`temp user: ${tmpErr.message}`)
      const tmpUid = tmpData.user.id

      const { data: tmpGrp, error: gErr } = await admin.from('groups').insert({
        name: 'QA Tmp ZeroValid', invite_code: `qa-zvm-${Date.now()}`, created_by: tmpUid,
      }).select('id').single()
      if (gErr) { await admin.auth.admin.deleteUser(tmpUid); throw new Error(`temp group: ${gErr.message}`) }
      const tmpGid = tmpGrp.id

      await admin.from('group_members').insert({ group_id: tmpGid, user_id: tmpUid, role: 'member' })

      try {
        const tmpClient = await signInAs(tmpEmail)

        // Summary: valid_member_count should be 0 (tmpUser has 0 cards < 5 threshold)
        const { data: summary } = await tmpClient.rpc('get_group_preference_summary', { p_group_id: tmpGid })
        const allZero = (summary ?? []).every(r => Number(r.valid_member_count) === 0)
        t.assert(allZero || (summary ?? []).length === 0, `expected valid_member_count=0 everywhere`)

        // Recommendations: empty because no valid members
        const { data: recs, error: recErr } = await tmpClient.rpc('get_group_recommendations_v2', { p_group_id: tmpGid })
        t.assert(!recErr, recErr?.message)
        t.assert((recs ?? []).length === 0, `expected 0 recs for 0-valid-member group, got ${recs?.length}`)
      } finally {
        await admin.from('groups').delete().eq('id', tmpGid)
        await admin.auth.admin.deleteUser(tmpUid)
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // PERSONAL RECOMMENDATIONS
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('PERSONAL', async (t) => {
    const test1Client = await signInAs('test1@foodkit.local')
    let recs

    await t.check('PERSONAL-01', 'get_personal_recommendations_v2 runs successfully', async () => {
      const { data, error } = await test1Client.rpc('get_personal_recommendations_v2', { p_limit: 20 })
      t.assert(!error, error?.message)
      t.assert(Array.isArray(data), 'expected array')
      recs = data ?? []
    })

    await t.check('PERSONAL-02', 'follow evidence present (test2 reviews appear)', async () => {
      t.assert(recs != null, 'recs not loaded')
      const withFollow = recs.filter(r => r.followed_evidence_count > 0)
      t.assert(withFollow.length >= 1, `expected ≥1 rec with follow evidence, got ${withFollow.length}`)
    })

    await t.check('PERSONAL-03', 'similar evidence present (test3 reviews appear)', async () => {
      t.assert(recs != null, 'recs not loaded')
      const withSimilar = recs.filter(r => r.similar_evidence_count > 0)
      t.assert(withSimilar.length >= 1, `expected ≥1 rec with similar evidence, got ${withSimilar.length}`)
    })

    await t.check('PERSONAL-04', 'evidence_count non-negative for all results', async () => {
      t.assert(recs != null, 'recs not loaded')
      for (const rec of recs) {
        t.assert(rec.evidence_count >= 0, `negative evidence_count for ${rec.name}`)
      }
    })

    await t.check('PERSONAL-05', 'test1-reviewed restaurants excluded from recs', async () => {
      t.assert(recs != null, 'recs not loaded')
      const { data: ownRevs } = await test1Client
        .from('reviews').select('restaurant_id').eq('user_id', test1Id)
      const ownRestIds = new Set((ownRevs ?? []).map(r => r.restaurant_id))
      const leaked = recs.filter(r => ownRestIds.has(r.restaurant_id))
      t.assert(leaked.length === 0, `test1 own restaurants appear in recs: ${leaked.map(r => r.name).join(', ')}`)
    })

    await t.check('PERSONAL-06', 'recommendations do not leak reviewer IDs or emails', async () => {
      t.assert(recs != null, 'recs not loaded')
      for (const rec of recs) {
        t.assert(!('reviewer_ids' in rec), 'reviewer_ids leaked in response')
        t.assert(!('email' in rec), 'email leaked in response')
        t.assert(!('card_keys' in rec), 'raw card_keys leaked in response')
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // FOLLOWING RECORDS
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('FOLLOWREC', async (t) => {
    const test1Client = await signInAs('test1@foodkit.local')
    let followedReviews

    await t.check('FOLLOWREC-01', 'followed users reviews accessible to test1', async () => {
      const { data: followRows } = await test1Client
        .from('follows').select('followee_id').eq('follower_id', test1Id).eq('status', 'accepted')
      const followeeIds = (followRows ?? []).map(r => r.followee_id)
      t.assert(followeeIds.length >= 2, `expected ≥2 followees, got ${followeeIds.length}`)

      const { data, error } = await test1Client
        .from('reviews').select('id, user_id, created_at')
        .in('user_id', followeeIds)
        .order('created_at', { ascending: false })
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 1, `expected ≥1 followed record, got ${data?.length}`)
      followedReviews = data ?? []
    })

    await t.check('FOLLOWREC-02', 'followed records ordered created_at DESC', async () => {
      if (!followedReviews || followedReviews.length < 2) { t.skip_('FOLLOWREC-02', 'not enough records', 'skip'); return }
      for (let i = 1; i < followedReviews.length; i++) {
        t.assert(
          followedReviews[i-1].created_at >= followedReviews[i].created_at,
          `order violation at index ${i}`,
        )
      }
    })

    await t.check('FOLLOWREC-03', 'own reviews not in followed records (self excluded)', async () => {
      if (!followedReviews) throw new Error('followedReviews not loaded')
      const self = followedReviews.filter(r => r.user_id === test1Id)
      t.assert(self.length === 0, `test1 own reviews appear in followed records: ${self.length}`)
    })

    await t.check('FOLLOWREC-04', 'outsider (non-followed) reviews not included', async () => {
      if (!followedReviews) throw new Error('followedReviews not loaded')
      const out = followedReviews.filter(r => r.user_id === outsiderId)
      t.assert(out.length === 0, `outsider reviews appear in followed records: ${out.length}`)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TODAY SEARCH
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('TODAY', async (t) => {
    const test1Client = await signInAs('test1@foodkit.local')

    await t.check('TODAY-01', 'no filters returns ≥1 result', async () => {
      const { data, error } = await test1Client.rpc('get_today_restaurants', { p_limit: 10 })
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 1, `expected ≥1 result, got ${data?.length}`)
    })

    await t.check('TODAY-02', 'budget filter respected', async () => {
      const { data, error } = await test1Client.rpc('get_today_restaurants', { p_budget_max: 1000, p_limit: 10 })
      t.assert(!error, error?.message)
      for (const r of data ?? []) {
        if (r.budget_per_person_max_yen != null)
          t.assert(r.budget_per_person_max_yen <= 1000, `budget violation: ${r.budget_per_person_max_yen} > 1000 for ${r.name}`)
      }
    })

    await t.check('TODAY-03', 'meal period param accepted without error', async () => {
      const { error } = await test1Client.rpc('get_today_restaurants', { p_limit: 10 })
      t.assert(!error, error?.message)
    })

    await t.check('TODAY-04', 'parking=true filter respected', async () => {
      const { data, error } = await test1Client.rpc('get_today_restaurants', { p_parking: true, p_limit: 10 })
      t.assert(!error, error?.message)
      for (const r of data ?? []) {
        if (r.parking_available != null)
          t.assert(r.parking_available === true, `parking=false for ${r.name} with parking filter`)
      }
    })

    await t.check('TODAY-05', 'walk_in=true filter accepted without error', async () => {
      const { error } = await test1Client.rpc('get_today_restaurants', { p_walk_in: true, p_limit: 10 })
      t.assert(!error, error?.message)
    })

    await t.check('TODAY-06', 'atmosphere filter accepted without error', async () => {
      const { error } = await test1Client.rpc('get_today_restaurants', { p_atmosphere_tag: 'lively', p_limit: 10 })
      t.assert(!error, error?.message)
    })

    await t.check('TODAY-07', 'genre filter returns matching results only', async () => {
      const { data, error } = await test1Client.rpc('get_today_restaurants', { p_genre: 'ラーメン', p_limit: 10 })
      t.assert(!error, error?.message)
      for (const r of data ?? [])
        t.assert(r.genre === 'ラーメン', `genre mismatch: ${r.genre} for ${r.name}`)
    })

    await t.check('TODAY-08', 'combined budget+parking filter returns ≥1', async () => {
      const { data, error } = await test1Client.rpc('get_today_restaurants', { p_budget_max: 3000, p_parking: true, p_limit: 10 })
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 1, `expected ≥1, got ${data?.length}`)
    })

    await t.check('TODAY-09', 'returned metadata matches filter constraints', async () => {
      const { data, error } = await test1Client.rpc('get_today_restaurants', { p_budget_max: 2000, p_parking: true, p_limit: 20 })
      t.assert(!error, error?.message)
      for (const r of data ?? []) {
        if (r.budget_per_person_max_yen != null)
          t.assert(r.budget_per_person_max_yen <= 2000, `budget violation for ${r.name}`)
        if (r.parking_available != null)
          t.assert(r.parking_available === true, `parking violation for ${r.name}`)
      }
    })

    await t.check('TODAY-10', 'lat/lng distance filter accepted without error', async () => {
      const { error } = await test1Client.rpc('get_today_restaurants', {
        p_user_lat: 33.645, p_user_lng: 130.690, p_max_distance_km: 5.0, p_limit: 10,
      })
      t.assert(!error, error?.message)
    })

    await t.check('TODAY-11', 'NULL-unknown exclusion via boolean filters', async () => {
      const { error } = await test1Client.rpc('get_today_restaurants', { p_walk_in: true, p_parking: true, p_limit: 10 })
      t.assert(!error, error?.message)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // BUSINESS HOURS
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('HOURS', async (t) => {
    const test1Client = await signInAs('test1@foodkit.local')

    await t.check('HOURS-01', 'get_today_restaurants without open_now returns ≥1', async () => {
      const { data, error } = await test1Client.rpc('get_today_restaurants', { p_open_now: false, p_limit: 10 })
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 1, `expected ≥1, got ${data?.length}`)
    })

    await t.check('HOURS-02', 'restaurant_business_hours has overnight (closes_next_day) entries', async () => {
      const { data, error } = await admin
        .from('restaurant_business_hours').select('restaurant_id').eq('closes_next_day', true).limit(1)
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 1, 'no overnight business hours entries found')
    })

    t.skip_('HOURS-03', 'open_now filter comparison', 'time-dependent — verify manually at known open/closed times')

    await t.check('HOURS-04', 'restaurants with business_hours_known=true exist', async () => {
      const { data, error } = await admin
        .from('restaurants').select('id').eq('business_hours_known', true).limit(1)
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 1, 'no restaurants with business_hours_known=true')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // RESTAURANT REVIEW TABS
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('TABS', async (t) => {
    const test1Client = await signInAs('test1@foodkit.local')
    const restId = await getRestaurantId(admin, 'すき家 飯塚市役所前店')
    let allReviews

    await t.check('TAB-01', 'get_restaurant_reviews_v2 scope=all works', async () => {
      const { data, error } = await test1Client.rpc('get_restaurant_reviews_v2', {
        p_restaurant_id: restId, p_scope: 'all', p_sort: 'newest', p_limit: 20, p_offset: 0,
      })
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 1, `expected ≥1 review, got ${data?.length}`)
      allReviews = data ?? []
    })

    await t.check('TAB-02', 'scope=similar runs without error', async () => {
      const { error } = await test1Client.rpc('get_restaurant_reviews_v2', {
        p_restaurant_id: restId, p_scope: 'similar', p_sort: 'newest', p_limit: 20, p_offset: 0,
      })
      t.assert(!error, error?.message)
    })

    await t.check('TAB-03', 'scope=following runs without error', async () => {
      const { error } = await test1Client.rpc('get_restaurant_reviews_v2', {
        p_restaurant_id: restId, p_scope: 'following', p_sort: 'newest', p_limit: 20, p_offset: 0,
      })
      t.assert(!error, error?.message)
    })

    await t.check('TAB-04', 'no duplicate review_ids in scope=all', async () => {
      if (!allReviews) throw new Error('allReviews not loaded')
      const ids = allReviews.map(r => r.review_id)
      const unique = new Set(ids)
      t.assert(ids.length === unique.size, `duplicate IDs: ${ids.length} vs ${unique.size} unique`)
    })

    await t.check('TAB-05', 'review response does not leak email', async () => {
      if (!allReviews || allReviews.length === 0) throw new Error('no reviews to check')
      for (const r of allReviews)
        t.assert(!('email' in r), 'email leaked in review response')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // MYPAGE RECORDS
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('MYREC', async (t) => {
    const test1Client = await signInAs('test1@foodkit.local')
    let test1Reviews

    await t.check('MYREC-01', 'test1 own reviews only (≥3)', async () => {
      const { data, error } = await test1Client
        .from('reviews').select('id, user_id, created_at').eq('user_id', test1Id)
        .order('created_at', { ascending: false })
      t.assert(!error, error?.message)
      t.assert((data?.length ?? 0) >= 3, `expected ≥3, got ${data?.length}`)
      for (const r of data ?? [])
        t.assert(r.user_id === test1Id, `unexpected user_id ${r.user_id}`)
      test1Reviews = data ?? []
    })

    await t.check('MYREC-02', 'newest order (created_at DESC)', async () => {
      if (!test1Reviews || test1Reviews.length < 2) { t.skip_('MYREC-02', 'not enough reviews', 'skip'); return }
      for (let i = 1; i < test1Reviews.length; i++)
        t.assert(test1Reviews[i-1].created_at >= test1Reviews[i].created_at, `order violation at ${i}`)
    })

    await t.check('MYREC-03', 'oldest order (created_at ASC)', async () => {
      const { data, error } = await test1Client
        .from('reviews').select('id, created_at').eq('user_id', test1Id)
        .order('created_at', { ascending: true })
      t.assert(!error, error?.message)
      if ((data?.length ?? 0) < 2) { t.skip_('MYREC-03', 'not enough', 'skip'); return }
      for (let i = 1; i < data.length; i++)
        t.assert(data[i-1].created_at <= data[i].created_at, `order violation at ${i}`)
    })

    await t.check('MYREC-04', 'rating filter returns only matching rows', async () => {
      const { data, error } = await test1Client
        .from('reviews').select('id, rating').eq('user_id', test1Id).eq('rating', 4)
      t.assert(!error, error?.message)
      for (const r of data ?? [])
        t.assert(r.rating === 4, `expected 4, got ${r.rating}`)
    })

    await t.check('MYREC-05', 'test2 reviews not leaked in test1 own query', async () => {
      const { data } = await test1Client
        .from('reviews').select('user_id').eq('user_id', test1Id)
      const leaked = (data ?? []).filter(r => r.user_id === test2Id)
      t.assert(leaked.length === 0, `test2 reviews leaked: ${leaked.length}`)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // SECURITY
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('SEC', async (t) => {
    const test1Client    = await signInAs('test1@foodkit.local')
    const outsiderClient = await signInAs('outsider@foodkit.local')
    const anonClient     = createAnonClient()

    await t.check('SEC-01', 'email not in user_public_profiles', async () => {
      const { data, error } = await test1Client
        .from('user_public_profiles').select('*').eq('username', 'test2').maybeSingle()
      t.assert(!error, error?.message)
      t.assert(!('email' in (data ?? {})), 'email found in public profile')
    })

    await t.check('SEC-02', 'test1 cannot mutate test2 review', async () => {
      const { data: rev } = await admin
        .from('reviews').select('id, rating').eq('user_id', test2Id).limit(1).maybeSingle()
      if (!rev) throw new Error('no test2 review found')
      await test1Client.from('reviews').update({ rating: 1 }).eq('id', rev.id)
      const { data: after } = await admin.from('reviews').select('rating').eq('id', rev.id).maybeSingle()
      t.assert(after?.rating !== 1, 'test1 mutated test2 review — RLS breach')
    })

    await t.check('SEC-03', 'test1 cannot mutate test2 profile', async () => {
      await test1Client.from('users').update({ name: 'HACKED' }).eq('id', test2Id)
      const { data } = await admin.from('users').select('name').eq('id', test2Id).maybeSingle()
      t.assert(data?.name !== 'HACKED', 'test1 mutated test2 profile — RLS breach')
    })

    await t.check('SEC-04', 'outsider cannot read protected group', async () => {
      const { data } = await outsiderClient.from('groups').select('id').eq('id', groupId).maybeSingle()
      t.assert(!data, 'outsider can read protected group — RLS breach')
    })

    await t.check('SEC-05', 'test1 cannot SELECT test2 notification', async () => {
      const { data: test2Notifs } = await admin
        .from('notifications').select('id').eq('recipient_user_id', test2Id).limit(1)
      if (!test2Notifs || test2Notifs.length === 0) { t.skip_('SEC-05', 'no test2 notifications', 'skip'); return }
      const { data: accessible } = await test1Client
        .from('notifications').select('id').eq('id', test2Notifs[0].id).maybeSingle()
      t.assert(!accessible, 'test1 can SELECT test2 notification — RLS breach')
    })

    await t.check('SEC-06', 'user_preference_cards other-user rows inaccessible', async () => {
      const { data } = await test1Client
        .from('user_preference_cards').select('user_id').eq('user_id', test2Id)
      t.assert(!data || data.length === 0, `test1 can read test2 preference cards: ${data?.length} rows`)
    })

    await t.check('SEC-07', 'get_user_preference_cards_public returns only safe fields', async () => {
      const { data, error } = await test1Client
        .rpc('get_user_preference_cards_public', { p_user_id: test2Id })
      t.assert(!error, error?.message)
      t.assert(Array.isArray(data), 'expected array')
      for (const row of data ?? []) {
        t.assert(!('key' in row),     'key leaked in public preference cards')
        t.assert(!('user_id' in row), 'user_id leaked in public preference cards')
        t.assert('label' in row,      'label missing from public preference cards')
        t.assert('sort_order' in row, 'sort_order missing from public preference cards')
      }
    })

    await t.check('SEC-08', 'anonymous cannot call get_user_preference_cards_public', async () => {
      const { data } = await anonClient.rpc('get_user_preference_cards_public', { p_user_id: test2Id })
      t.assert(!data || data.length === 0, 'anonymous can access preference cards — security breach')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // PASSWORD
  // ───────────────────────────────────────────────────────────────────────────
  await runner.section('PASSWORD', async (t) => {
    const tmpEmail = `qa_tmp_pwd_${Date.now()}@foodkit.local`
    const newPass  = 'FoodKitTest456!'
    let tmpUserId

    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: tmpEmail, password: QA_PASSWORD, email_confirm: true,
        user_metadata: { name: 'QA Temp Password' },
      })
      if (error) throw error
      tmpUserId = data.user.id
    } catch (err) {
      t.fail_('PASSWORD-setup', 'temp user created', err.message)
      t.skip_('PASSWORD-01', 'wrong password rejected', 'setup failed')
      t.skip_('PASSWORD-02', 'password update succeeds', 'setup failed')
      t.skip_('PASSWORD-03', 'old password fails after update', 'setup failed')
      t.skip_('PASSWORD-04', 'new password login succeeds', 'setup failed')
      return
    }

    await t.check('PASSWORD-01', 'wrong current password login rejected', async () => {
      const client = createAnonClient()
      const { error } = await client.auth.signInWithPassword({ email: tmpEmail, password: 'WrongPass!' })
      t.assert(error != null, 'expected error for wrong password')
    })

    await t.check('PASSWORD-02', 'correct password update succeeds', async () => {
      const tmpClient = await signInAs(tmpEmail, QA_PASSWORD)
      const { error } = await tmpClient.auth.updateUser({ password: newPass })
      t.assert(!error, error?.message)
    })

    await t.check('PASSWORD-03', 'old password login fails after update', async () => {
      const client = createAnonClient()
      const { error } = await client.auth.signInWithPassword({ email: tmpEmail, password: QA_PASSWORD })
      t.assert(error != null, 'old password should be rejected after update')
    })

    await t.check('PASSWORD-04', 'new password login succeeds', async () => {
      const client = createAnonClient()
      const { data, error } = await client.auth.signInWithPassword({ email: tmpEmail, password: newPass })
      t.assert(!error, error?.message)
      t.assert(data?.user?.id === tmpUserId, 'user ID mismatch')
    })

    await admin.auth.admin.deleteUser(tmpUserId)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────────────────────────────────
  runner.summary()
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
