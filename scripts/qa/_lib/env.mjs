// LOCAL QA ONLY — These are the standard Supabase local development demo keys.
// They are the same for every local Supabase instance and are publicly documented.
// Never use production keys here.

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../..')

export function loadEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch { /* no .env.local */ }
}

// Standard local Supabase demo keys (public, same for all local instances)
const LOCAL_URL_DEFAULT  = 'http://127.0.0.1:54321'
const LOCAL_ANON_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SRK_DEFAULT  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? LOCAL_URL_DEFAULT
}
export function getAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? LOCAL_ANON_DEFAULT
}
export function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SRK_DEFAULT
}

export function guardLocal() {
  const url = getSupabaseUrl()
  const isLocal = url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')
  if (!isLocal) {
    console.error('\nQA HARNESS REFUSED: non-local Supabase detected')
    console.error(`  URL: ${url}`)
    console.error('  Only http://127.0.0.1:* or http://localhost:* is allowed.\n')
    process.exit(1)
  }
}

export function createAdminClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createAnonClient() {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function signInAs(email, password = 'FoodKitTest123!') {
  const client = createAnonClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signInAs(${email}): ${error.message}`)
  return client
}

// QA_PASSWORD — LOCAL QA ONLY, never use in production
export const QA_PASSWORD = 'FoodKitTest123!'
