# Dubious Professors — TODO

Compiled from full conversation. Updated as we go.

---

## ✅ Done

### Lobby code generation
- **Algorithmic fix** to `generateRoomCode` — now takes a `takenCodes` Set and picks from *free* funny codes rather than blindly re-rolling.
- **Empirical verification**: empty pool → 49.9% funny, 16/17 taken → 50.1%, all taken → 0% (graceful, no infinite loop).
- **Added 'ABG'** to the funny pool. Now 18 codes total.
- **Stale room cleanup**: every `createRoom` now sweeps rooms older than 4 hours with no connected players, recycling their funny codes back into the pool. This is the *real* fix for the <25% observation — the algorithm was correct, but it was correctly producing 0% funny because the pool was saturated by abandoned rooms that never expired.

### Name entry
- Empty name submits allowed — picks a random "Bobson Dugnutt"-style fallback from 22 names.
- All 22 names properly title-cased with Mc capitalization preserved (Sleve McDichael, Rey McSriff, Mario McRlwain).
- Fallback filters against `existingNames` (case-insensitive) so two blank-submitters get different names.
- Race-condition retry: if two players blank-submit simultaneously and collide, `handleJoinRoom` transparently retries with a fresh fallback up to 3 times — user never sees a confusing "name taken" error for a name they didn't type.
- Placeholder text updated to "Enter name (or leave blank)".

### Results screen
- Worked out the full truth table (Interrogator vs. Everyone Else — Dubious are bluffers on the Truthful's team).
- All 7 outcome scenarios produce correct win/loss messaging.
- Added green/red headline color based on whether the viewing player personally won.
- Hardened against player-leaves-mid-results: optional chaining + `(left)` fallback so the screen never crashes.

### Game-flow correctness
- `beginGame` and `startRoleReveal` now filter to **connected** players when randomly assigning Interrogator / Truthful. Disconnected ghosts can no longer be assigned a role.
- "Run It Back" button now visible to **both** Interrogator and Host. If Interrogator disconnects during results phase, host can still advance the round.
- App.jsx handler functions moved above JSX returns. No longer relying on function hoisting — survives a future `const handleX = ...` refactor.

---

## 🧠 Brainstorm / pending decision

### The original ask — Article picker filtering
- **Problem**: game pulls from `Wikipedia:Unusual_articles` but many linked titles are boring/famous (Fidel Castro, Potatoes, Democratic Republic of the Congo). Game hinges on the *title* being funny/bizarre/unobvious AND not widely known.
- **Examples of good**: "Feast of the Ass", "Green Monster", "Northwest Lincolnshire By-election of 1871".
- **Brainstormed 10 approaches** earlier. Recommendation: one-shot LLM pre-filter → static `goodTitles.json` (#7 in the list).
- **Decision pending** — pick an approach + implement. See "Approaches" section in chat.

### More lobby-code ideas (in case stale cleanup isn't enough)
- **Expand the curated funny pool** — more headroom against saturation. Easy add to `roomCode.js`.
- **Algorithmic funny-code generation** — consonant-vowel-consonant patterns. With ~15 consonants × 5 vowels × 15 consonants ≈ 1,125 CVC codes, a huge proportion sound silly (BOB, POG, BUH, OOF, FRR, RIZ, ICL, etc.). Vastly increases the funny pool without manual curation.
- **Tiered pool**: A-tier favorites first, B-tier reserve only when A-tier saturated.
- **Per-host active-room cap** — only one open room per host at a time; new create destroys their previous abandoned one.
- **TTL via Firebase Cloud Functions** — server-side scheduled cleanup. Requires backend setup but is the most robust solution.
- **Make `keepLobby` a user-facing toggle in SettingsScreen** — currently hardcoded `true`. Letting users opt-in to "destroy lobby after round" reduces saturation naturally.
- **"Destroy this room" button** in the lobby for hosts.

### Other ideas surfaced
- "This article was boring / great" feedback button after rounds to inform future article-list curation.
- "Skip" button on the article-select screen to redraw the 6 candidates without committing to one.

---

## Notes / known constraints

- App auto-deploys to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`). **Local code changes won't affect the deployed game until pushed.** If testing the deployed version, push first.
- Firebase is Realtime Database (`dubious-professors-default-rtdb.firebaseio.com`). No native TTL — cleanup is client-side on `createRoom`.
- Existing rooms in Firebase that pre-date the stale-cleanup feature may lack `createdAt` and won't be auto-cleaned (conservative — won't accidentally delete user data). To kickstart the funny-code pool, a one-time manual wipe of `rooms/` in the Firebase console is recommended.
