#!/usr/bin/env node
// LOCAL QA ONLY — runs lint + tsc + build in sequence

import { execSync } from 'child_process'

const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '')

function run(label, cmd) {
  console.log(`\n[${label}] ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT })
    console.log(`  ✓ ${label} passed`)
    return true
  } catch {
    console.error(`  ✗ ${label} FAILED`)
    return false
  }
}

const results = [
  run('lint',  'npm run lint'),
  run('tsc',   'npx tsc --noEmit'),
  run('build', 'npm run build'),
]

console.log('\n================================')
console.log('FoodKit QA Quality')
results.forEach((ok, i) => {
  const name = ['lint', 'tsc', 'build'][i]
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}`)
})
console.log('================================\n')

if (results.some(r => !r)) process.exit(1)
