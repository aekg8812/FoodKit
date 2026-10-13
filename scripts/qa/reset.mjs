#!/usr/bin/env node
// LOCAL QA ONLY — resets local Supabase and seeds deterministic QA fixtures

import { execSync } from 'child_process'
import { loadEnv, guardLocal, createAdminClient } from './_lib/env.mjs'
import {
  createQAUsers,
  setPreferenceCards,
  createReviews,
  createGroup,
  createBaseFollows,
  validateFixture,
  uploadRestaurantMainImage,
} from './_lib/seed.mjs'

loadEnv()
guardLocal()

async function main() {
  console.log('=== FoodKit QA Reset ===\n')

  // 1/6 — db reset
  console.log('[1/6] Running supabase db reset --local ...')
  try {
    execSync('supabase db reset --local', { stdio: 'inherit', cwd: process.cwd() })
  } catch (err) {
    console.error('supabase db reset failed:', err.message)
    process.exit(1)
  }
  console.log('')

  const admin = createAdminClient()

  // 2/6 — QA users
  console.log('[2/6] Creating QA users ...')
  let userIds
  try {
    userIds = await createQAUsers(admin)
    for (const [u, id] of Object.entries(userIds)) {
      console.log(`  ✓ ${u} (${id.slice(0, 8)}...)`)
    }
  } catch (err) {
    console.error('User creation failed:', err.message)
    process.exit(1)
  }

  // 3/6 — preference cards
  console.log('\n[3/6] Setting preference cards ...')
  try {
    await setPreferenceCards(admin, userIds)
    console.log('  ✓ Preference cards set for test1, test2, test3')
  } catch (err) {
    console.error('Preference cards failed:', err.message)
    process.exit(1)
  }

  // 4/6 — reviews
  console.log('\n[4/6] Creating QA reviews ...')
  try {
    await createReviews(admin, userIds)
    console.log('  ✓ 7 reviews created')
  } catch (err) {
    console.error('Reviews failed:', err.message)
    process.exit(1)
  }

  // 5/6 — group + follows
  console.log('\n[5/6] Creating group and follows ...')
  try {
    const groupId = await createGroup(admin, userIds)
    console.log(`  ✓ QA Group A (${groupId.slice(0, 8)}...)`)
    await createBaseFollows(admin, userIds)
    console.log('  ✓ test1→test2, test1→test3 follows created')
  } catch (err) {
    console.error('Group/follows failed:', err.message)
    process.exit(1)
  }

  // 6/7 — restaurant main image fixture
  console.log('\n[6/7] Uploading restaurant main image fixture ...')
  try {
    // Seed one restaurant with a main image (すき家 飯塚市役所前店) for image display tests
    const { data: targetRest } = await admin
      .from('restaurants')
      .select('id')
      .eq('name', 'すき家 飯塚市役所前店')
      .maybeSingle()
    if (targetRest) {
      await uploadRestaurantMainImage(admin, targetRest.id)
      console.log(`  ✓ main_image_path set for すき家 飯塚市役所前店 (${targetRest.id.slice(0, 8)}...)`)
    } else {
      console.warn('  ⚠ すき家 飯塚市役所前店 not found — skipping image fixture')
    }
  } catch (err) {
    console.error('Restaurant image fixture failed:', err.message)
    process.exit(1)
  }

  // 7/7 — validate
  console.log('\n[7/7] Validating fixture ...')
  try {
    await validateFixture(admin, userIds)
  } catch (err) {
    console.error('Validation FAILED:', err.message)
    process.exit(1)
  }

  console.log('\n=== qa:reset complete ===')
  console.log('Restaurant image fixture: すき家 飯塚市役所前店 has main_image_path (others NULL)\n')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
