#!/usr/bin/env node
// End-to-end probe for the title-feedback loop. Exercises the SAME Firebase write
// path the in-game results button uses (feedbackKey escaping + atomic increment),
// against the real RTDB configured in .env.local. Also proves the security rules
// permit feedback writes (if they don't, the in-game button would fail too).
//
//   node scripts/test/feedback-e2e.mjs write   # simulate 2 players flagging, assert downvotes=2
//   node scripts/test/feedback-e2e.mjs clean   # delete the probe node
//
// The probe title contains a '[' so it also exercises RTDB key escaping.

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, update, get, remove, increment, serverTimestamp } from 'firebase/database'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const mode = process.argv[2] || 'write'
const PROBE = 'E2E probe title [delete me]'

// Must stay identical to feedbackKey() in src/hooks/useGameState.js.
function feedbackKey(title) {
  return title.replace(/[.#$/[\]]/g, (c) => `~${c.charCodeAt(0)}~`)
}

async function loadEnv() {
  const txt = await readFile(resolve(ROOT, '.env.local'), 'utf8')
  const env = {}
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = await loadEnv()
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})
const db = getDatabase(app)
const key = feedbackKey(PROBE)
const node = ref(db, `feedback/${key}`)

try {
  if (mode === 'clean') {
    await remove(node)
    console.log('cleaned probe node')
    process.exit(0)
  }

  // Same path as useGameState.flagTitle, called twice (two "players").
  const flag = () => update(node, { title: PROBE, downvotes: increment(1), lastFlagged: serverTimestamp() })
  await flag()
  await flag()

  const val = (await get(node)).val()
  console.log('readback:', JSON.stringify(val))
  if (!val || val.downvotes !== 2) throw new Error(`expected downvotes=2, got ${val && val.downvotes}`)
  if (val.title !== PROBE) throw new Error('title field mismatch')
  console.log(`PASS: increment + key-escaping write path verified (downvotes=2, key="${key}")`)
  process.exit(0)
} catch (e) {
  console.error('FAIL:', e.message)
  process.exit(1)
}
