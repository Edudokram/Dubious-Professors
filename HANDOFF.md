# Dubious Professors — Curation Pipeline Handoff

> **For:** the next Claude Code instance picking up this work.
> **Status as of handoff:** Round 4 of the title-curation pipeline wedged at ~6,000/27,398. The previous Claude (Opus 4.7 in Claude Desktop) accidentally killed all `node.exe` processes — including the cmd-bridge MCP server — while trying to clean up. The chat had to be abandoned. You're inheriting a healthy repo and master corpus, but with ~60 zombie processes and an unfinished round 4. Pick up cleanly.

---

## 0. Operating instructions for YOU (read first)

These are inherited user preferences. Honor them.

1. **Snowball first for technical questions.** Before any technical, tooling, architectural, or project decision, call `snowball:search_with_trust` with a relevant query. If it returns nothing useful, try one rephrasing, then proceed. Only skip for clearly non-technical messages. When citing a snowball, mention which snowball so the user can trace it. Snowball is higher authority than your training data when they conflict.
2. **If snowball is broken in any way, halt and tell the user.** Don't proceed silently.
3. **Diagnose before treating.** Every time you think you understand an issue or solution, run a quick test that tries to *disprove* the hypothesis (e.g., "if X isn't the cause, then when we do Y we should see Z"). The user explicitly asks for this.
4. **You have cmd.exe access on Windows + full filesystem.** Use it. Don't ask permission to run code. The user is on Windows 11. Repo lives at `C:\Users\schma\Desktop\DubiousProfessors`.
5. **Tone:** conversational prose, minimal headers/bullets, no emoji unless the user uses them. Don't pile on apologies; own mistakes once and move on.
6. **Critical gotcha from the previous session:** **DO NOT** run `taskkill /F /IM node.exe` broadly. The cmd-bridge MCP server is also a node process and you will kill yourself. Use targeted kills by PID, or filter by image path. (See "Lessons learned" below.)

---

## 1. The product

**Dubious Professors** is a real-time multiplayer party game (React + Vite + Firebase RTDB). Each round:
- One player is the Interrogator. The other players are Professors.
- Each Professor picks a Wikipedia article from a list of 6 random titles. One is designated Truthful and actually reads their article; the others (Dubious) just see the title and bluff.
- All Professors get questioned about their article. The Interrogator guesses who's truthful. Correct → Interrogator wins; wrong → the Truthful + all Dubious win as a team.

**The entire game hinges on the article title.** The Title is the only thing the Dubious bluffers see — they have to riff plausibly from the title alone. A good title is *funny, bizarre, or unobvious* AND *not widely known*.

Good (yes): "Feast of the Ass", "Green Monster", "The Northwest Lincolnshire By-election of 1871", "Hotheaded Naked Ice Borer", "Bog snorkelling", "Cox–Zucker machine", "A Kitten for Hitler".

Bad (no): "Fidel Castro", "Potatoes", "Democratic Republic of the Congo" — everyone recognizes them, so no bluff is possible.

The whole curation pipeline exists to harvest, filter, and ship a static JSON list of titles that pass that bar.

---

## 2. Repo layout

```
C:\Users\schma\Desktop\DubiousProfessors\
├── src\
│   ├── lib\
│   │   ├── wikipedia.js          # runtime: imports curatedTitles.json, draws random
│   │   ├── roomCode.js           # 50/50 funny-vs-random lobby code generator
│   │   ├── fallbackNames.js      # Bobson-Dugnutt-style names for blank submissions
│   │   └── howToPlay.js          # game rules text
│   ├── data\
│   │   ├── curatedTitles.json    # SHIPPED: array of strings, what the game loads
│   │   └── curatedTitles.meta.json  # [{title, qid}] for durability/revalidation
│   ├── hooks\useGameState.js     # Firebase + game state (createRoom, joinRoom, etc.)
│   ├── screens\                  # React screens (Lobby, Article-select, Results, ...)
│   └── App.jsx
├── scripts\
│   ├── harvest\                  # Stage 0: discover candidate titles from sources
│   │   ├── lib.mjs               # shared MediaWiki/Wikidata API helpers + backoff
│   │   ├── category.mjs          # v1 funny-category crawler (12k+ titles)
│   │   ├── category-v2.mjs       # v2: 8 reclaimed category names (3.8k titles)
│   │   ├── snowball.mjs          # See-Also outlink snowball from keepers
│   │   ├── wikidata.mjs          # BROKEN — needs P31-only + verified QIDs
│   │   └── probe-categories.mjs  # diagnostic for verifying category names
│   ├── pipeline\                 # Stages 1-4: enrich → tag → ship → revalidate
│   │   ├── master.mjs            # master corpus helpers (load/save/stats)
│   │   ├── seed-master.mjs       # merge harvest outputs + legacy files into master
│   │   ├── enrich-langlinks.mjs  # fetch langlinks + QID for each entry
│   │   ├── tag-parallel.mjs      # parallel LLM taste tagging (THE BOTTLENECK)
│   │   ├── cleanup-heuristic.mjs # retroactive heuristic cleanup (dry-run by default)
│   │   └── revalidate.mjs        # quarterly QID self-heal (renames + deletions)
│   ├── build-final.mjs           # build curatedTitles.json + .meta.json from master
│   ├── overrides.json            # manual allow/deny lists
│   └── output\
│       ├── master.json           # THE master corpus (keyed by title)
│       ├── harvest\              # per-source harvest outputs
│       │   ├── category.json
│       │   ├── category-v2.json
│       │   └── snowball.json     # gets overwritten each snowball run
│       ├── candidates.json       # legacy from round 0
│       ├── tagged.json           # legacy from round 0
│       └── *-run.log             # per-run logs
└── HANDOFF.md                    # ← you are here
```

---

## 3. The pipeline architecture

Designed for **incrementality and durability**. Every stage is idempotent and resumable. Add new harvest sources, re-run the funnel, list only grows.

```
[harvest sources] ──→ scripts/output/harvest/*.json
       │
       ▼
seed-master.mjs ─→ master.json   (dedup'd, keyed by title, sources tagged)
       │
       ▼
enrich-langlinks.mjs ─→ adds langlinkCount + qid + exists       (fast, ~120/sec)
       │
       ▼
tag-parallel.mjs ─→ auto-cuts famous (langlinks ≥ 30) and obvious
                    junk (title heuristic), then LLM-tags the rest
                    in N parallel workers via `claude -p`           (the bottleneck)
       │
       ▼
build-final.mjs ─→ src/data/curatedTitles.json (+ .meta.json with QIDs)
                   applies overrides.json allow/deny
       │
       ▼
[shipped to the game]
       │
       ▼ (quarterly)
revalidate.mjs ─→ re-resolves QIDs via Wikidata: handles renames + deletions
```

**Master entry shape** (`scripts/output/master.json`):
```json
{
  "Feast of the Ass": {
    "qid": "Q1234567",
    "langlinkCount": 7,
    "decision": "keep",
    "reason": "obscure folk festival, bizarre name",
    "exists": true,
    "sources": ["unusual-articles", "category-crawl"],
    "firstSeen": "...", "lastChecked": "..."
  }
}
```

**Why master keyed by title:** natural dedup across sources, every stage can be idempotent ("only process entries missing my field"), atomic save (tmp+rename) prevents corruption on interrupt.

**Why QID anchoring:** the user explicitly required "constantly valid even years into the future." QIDs are permanent; titles get renamed. `revalidate.mjs` resolves each QID → current enwiki title via Wikidata API, marks `exists: false` on deletions, records `renamedTo` on moves. Run it quarterly via cron/calendar reminder.

---

## 4. Current state on disk (verified at handoff)

```
master.json:
  total:           147,150 titles
  withLanglinks:   147,150  ← stage 1 fully done
  withDecision:    122,574
  withQid:         125,231
  KEEP:             22,208  ← what would be shipped if we ran build-final now
  CUT:             100,366
  LLM-pending:      22,998  ← titles with decision=null, exists=true, langlinks<30

src/data/curatedTitles.json: 21,669 titles  (built from rounds 1-3 only — round 4 not yet shipped)
```

**Source contributions to master:**
- `unusual-articles`: 7,214 (Wikipedia:Unusual_articles — the original source)
- `category-crawl` (v1): 26,016 (Hoaxes, Memes, Cryptids, etc. — 30 seed categories)
- `category-crawl-v2`: 3,803 (8 reclaimed categories: Pretenders, Folk festivals, Moral panic, …)
- `see-also-snowball`: 113,530 (compounding from keepers across 3 rounds)

**Process state:** 41 leaked node + 19 leaked claude processes still in memory from the wedged round-4 tagger. Targeted cleanup needed (NOT `taskkill /F /IM node.exe` — that kills the MCP server). Use `tasklist /V /FI "IMAGENAME eq claude.exe"` to find them by PID, kill specific PIDs.

---

## 5. The incident (why round 4 wedged)

**Symptom:** tag-parallel.mjs with `--workers=7` made it to ~6,000/27,398 then started throwing `spawn UNKNOWN`, `exit 3221225773` (Windows access violation), and Bun init crash dumps. Failures cascaded; the run stalled.

**Root cause:** each `claude -p` call spawns a Bun-wrapped node subprocess. On Windows, with 7 concurrent long-running workers each spawning fresh subprocesses every ~30s, child processes weren't being fully reaped — accumulated to ~98 zombies after ~64 batches × 7 workers, hit a Windows process/handle limit, then new spawns failed.

**Fix going forward:** default to `--workers=3` (proven stable in round 1 of LLM tagging at 5 workers, but headroom is helpful). Don't push to 7+ workers on Windows. If you want speed, find a smarter LLM-call path (see Future Work section).

**My ending mistake:** I tried to clean up zombies with `taskkill /F /IM node.exe`, which killed the cmd-bridge MCP server itself (also a node process). The chat became unresponsive. Lesson: **never use unfiltered `/IM node.exe` on this machine**.

---

## 6. Your immediate task (resume round 4 and ship)

Concrete ordered steps. Run them as written.

**Step 1.** Verify the MCP is alive and the repo is intact.
```bat
cd /d C:\Users\schma\Desktop\DubiousProfessors
echo MCP_alive
dir scripts\output\master.json
```

**Step 2.** Snowball-check before touching anything: `snowball:search_with_trust` for "dubious professors title pipeline" and "wikipedia mediawiki langlinks pagination batched". (We previously found nothing in the corpus on this — but verify on your machine; the corpus may have grown.)

**Step 3.** Clean up zombies *carefully*. Filter to only the curation-spawned ones.
```bat
:: First, see what's stuck (don't kill the MCP server's own node.exe):
tasklist /V /FI "IMAGENAME eq claude.exe"
tasklist /V /FI "IMAGENAME eq bun.exe"

:: !!! CORRECTION (2026-06-05, next Claude): do NOT blanket `taskkill /F /IM claude.exe`.
:: That advice was written from a Claude DESKTOP session where claude.exe meant only the
:: `claude -p` tagger subprocesses. If you are running as Claude CODE (the CLI), you ARE a
:: claude.exe and so are any Claude Desktop apps — killing all of them is the exact self-kill
:: class as `/IM node.exe`. Kill ONLY the tagger workers, identified by their command line:
::   powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='claude.exe'\" | Where-Object { $_.CommandLine -match '--no-session-persistence' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
:: bun.exe has no such ambiguity, so this one is fine:
taskkill /F /IM bun.exe 2>nul
:: Also note: by the time I arrived the leaked zombies were already gone. VERIFY before killing
:: anything (look for actual `tag-parallel.mjs` node procs / `claude -p` workers); don't kill blind.

:: For leftover node.exe, find the curation-related ones BY PARENT or by command line.
:: WARNING: do NOT run `taskkill /F /IM node.exe` — kills the MCP server.
:: If you must kill node processes, find them by inspecting command lines:
wmic process where "name='node.exe'" get processid,commandline /format:list
:: …then `taskkill /F /PID <specific-pid>` for any tag-parallel.mjs or claude-related ones.
```

**Step 4.** Patch `scripts/pipeline/tag-parallel.mjs` to be safer at scale.
Change the worker default from 6 to 3 and add explicit child cleanup on errors. Search for the line:
```js
const WORKERS = parseInt(args.workers || '6', 10)
```
Change to:
```js
const WORKERS = parseInt(args.workers || '3', 10)
```
Also in `callClaude`: add a try/finally that calls `child.kill('SIGKILL')` if the promise rejects, to make sure even crashed Bun processes don't linger.

Verify your edits with a quick test invocation:
```bat
node -e "import('./scripts/pipeline/master.mjs').then(async m => { const x = await m.loadMaster(); console.log('LLM-pending:', Object.values(x).filter(e => e.decision === null && e.exists !== false && (e.langlinkCount ?? 0) < 30).length); })"
:: should report ~22,998 pending
```

**Step 5.** Resume tagging with 3 workers. Script auto-skips entries already decided.
```bat
:: This will take ~75 minutes for 22,998 titles at 3-worker rate.
:: Run in foreground or background — it checkpoints to master every 3 batches.
node scripts\pipeline\tag-parallel.mjs --workers=3 --model=haiku
```

**Step 6.** Ship.
```bat
node scripts\build-final.mjs    :: emits src/data/curatedTitles.json + .meta.json
npx vite build                  :: verify the React app compiles with the new list
```

Spot-check the shipped list quality:
```bat
node --input-type=module -e "const m=await import('./src/lib/wikipedia.js');const a=await m.fetchRandomArticles(30);for(const x of a)console.log(' ',x.title);"
```

Expected: ~28,000-30,000 keepers after round 4 finishes (up from 22,208 partial + ~6-8k new from the unfinished 23k).

---

## 7. Known issues to fix while you're in there

**A. `scripts/harvest/wikidata.mjs` is broken (cut from the pipeline).**
The SPARQL query uses `wdt:P31/wdt:P279*` which traverses entire subclass trees and pulls thousands of unrelated entries (universities, cyclones, eclipses). Additionally, several hardcoded class QIDs in the file are wrong — e.g., the supposed "cargo cult" QID returned universities, meaning Q193622 isn't actually cargo cult.

Fix path: (a) verify each QID by hitting `https://www.wikidata.org/wiki/Q######` and confirming the label. (b) change the SPARQL to use only direct `wdt:P31` (no `/wdt:P279*`). (c) re-run and sanity-check the first 30 results before merging.

Even when fixed, expect smaller yields than the category crawl. Probably not worth more than half a day of effort.

**B. The heuristic pre-cut in `tag-parallel.mjs` was over-broad and we narrowed it mid-flight.**
The current patterns in the file are the **tightened** version. The original was cutting things like "In Soviet Russia", "NFL SuperPro", and "Wallpaper (musician)" as false positives because the "in + word" pattern didn't require a year prefix and the parenthetical-role list was too aggressive. Don't loosen these patterns again without re-running `cleanup-heuristic.mjs --dry-run` first to see what gets caught.

**C. `cleanup-heuristic.mjs` was written to retroactively demote existing keepers that match the heuristic.**
We chose NOT to run it because of the false positives identified above. Leave it in the repo but don't run `--apply` without a careful dry-run review.

**D. The snowball harvester uses ALL outlinks (`prop=links`), not just "See Also" section links.**
This catches more candidates but also more noise. A higher-precision variant would parse the article's See-Also section from wikitext. Not yet built. Backlog.

**E. The current 22,208 keepers may include some lower-quality titles** the LLM let through (parenthetical-role disambiguators, obscure sports teams, etc.). The user has accepted this trade-off for volume. Manual triage via `scripts/overrides.json` denying specific titles is the simplest path to surgical removal.

---

## 8. Future expansion (after round 4 ships)

The "compounding snowball" + "category crawl" approach has yielded roughly 22-28k titles. To push further, in priority order:

**Highest yield: full Wikipedia all-titles dump miner.**
Download the all-titles enwiki dump (~150MB compressed, ~17M titles total at https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-all-titles-in-ns0.gz). Regex-mine for funny-title patterns: legal cases (`/^.+ v\.? .+$/`), parenthetical disambiguators of weird things (`/\((diamond|horse|cocktail|cult)\)$/`), "The Great __", "__ incident/controversy/riot", year + obscure place patterns, oddly specific historical events. Run through the same langlinks + LLM funnel. Realistic ceiling: 30-50k additional keepers. Build under `scripts/harvest/dump-miner.mjs`.

**Medium yield: snowball round 4+ from the new (larger) keeper pool.**
With ~28k keepers as seeds, expect 15-30k new candidates per round before fully exhausting the close neighborhood. Diminishing returns (round 1 = 47k new, round 2 = 34k, round 3 = 31k, round 4 likely ~20k).

**Medium yield: more reclaimed categories.**
The probe in `probe-categories.mjs` only checked a dozen variants. Many more inherently-funny Wikipedia categories exist. Run a broader exploration via `action=query&list=allcategories` + grep for likely candidates.

**Low-medium yield: Wikidata SPARQL (after fixing).**
Once the QIDs are verified and the subclass traversal is removed, expect 5-15k well-typed candidates.

**Low yield but ongoing: passive random sampling.**
`Special:Random` at scale, filter through the funnel. Could be a cron job that adds ~50 vetted titles per day indefinitely.

**Quality lever (vs volume): in-game feedback loop.**
Add a small thumbs-down on the results screen so players can flag bad titles. Persist to Firebase, periodically pull into `scripts/overrides.json` deny list. Self-improving curation. Builds the game's "taste" over time without manual work.

---

## 9. Lessons learned — read these before touching anything

1. **`taskkill /F /IM node.exe` is forbidden on this machine.** The cmd-bridge MCP server is a node process. Killing all node processes will kill yourself. Use PID-targeted kills, or `IMAGENAME eq claude.exe` / `eq bun.exe` filters.

2. **Claude CLI `--bare` flag breaks OAuth.** The `--bare` flag explicitly disables OAuth/keychain credential lookup. Without it, the user's existing `~/.claude/.credentials.json` login works. The current scripts already drop `--bare`. Don't re-add it.

3. **Pass system prompts via STDIN, not `--append-system-prompt`.** Multi-line prompts get mangled by cmd.exe shell escaping when passed as CLI args. The scripts prepend `SYSTEM_PROMPT + '\n\n' + userMessage` to stdin instead, which is robust. Keep it that way.

4. **MediaWiki `lllimit` is per-response total, not per-page.** A famous title in a batch eats the entire langlinks budget. Always paginate via `continue.llcontinue` (see `enrich-langlinks.mjs`). Earlier code that didn't paginate produced garbage data where 97% of pages reported 0 langlinks.

5. **7 parallel `claude -p` workers leak processes on Windows.** Use 3-4. The throughput plateau isn't worth the instability.

6. **Always atomic-write the master.** `master.mjs` uses temp-file + rename so a crash mid-write can't corrupt it. Preserve that pattern in any new pipeline stage.

7. **Be careful with Wikipedia API user-agents.** Without a descriptive User-Agent, you'll get 429'd hard. `scripts/harvest/lib.mjs` exports `USER_AGENT` — use it.

8. **The user has snowball MCP and prefers it as ground truth.** Always `snowball:search_with_trust` for technical questions before answering from training. Cite the source snowball when you do. If snowball is broken (no response, error), HALT and tell the user.

9. **Diagnose by trying to disprove your hypothesis.** The user explicitly asks for this style. Don't just propose a fix — propose what you'd expect to see if your diagnosis is *wrong*, then check.

---

## 10. Reference: command cheatsheet

```bat
:: Inspect current master state
node -e "import('./scripts/pipeline/master.mjs').then(async m => { const x = await m.loadMaster(); console.log(JSON.stringify(m.stats(x), null, 2)); })"

:: Count LLM-pending (titles waiting for the LLM, not yet auto-cut)
node -e "import('./scripts/pipeline/master.mjs').then(async m => { const x = await m.loadMaster(); console.log('LLM-pending:', Object.values(x).filter(e => e.decision === null && e.exists !== false && (e.langlinkCount ?? 0) < 30).length); })"

:: Resume tagging (safe defaults)
node scripts\pipeline\tag-parallel.mjs --workers=3 --model=haiku

:: Run a fresh harvest pass
node scripts\harvest\category.mjs               :: v1 (~12k titles, ~5 min)
node scripts\harvest\category-v2.mjs            :: v2 (~3.8k, ~1 min)
node scripts\harvest\snowball.mjs --seeds=2500  :: takes ~3-5 min, seeds from current keepers

:: Funnel a fresh harvest through the pipeline
node scripts\pipeline\seed-master.mjs           :: merges any new harvest/*.json
node scripts\pipeline\enrich-langlinks.mjs      :: ~2-5 min per 10k new entries
node scripts\pipeline\tag-parallel.mjs --workers=3 --model=haiku
node scripts\build-final.mjs
npx vite build

:: Quarterly maintenance
node scripts\pipeline\revalidate.mjs            :: QID self-heal; updates renamed/deleted

:: Sample the shipped list (sanity check after build)
node --input-type=module -e "const m=await import('./src/lib/wikipedia.js');const a=await m.fetchRandomArticles(30);for(const x of a)console.log(' ',x.title);"
```

---

## 11. Things the previous Claude did NOT get to

- Resume round 4 tagging after the process leak (the immediate task)
- Apply the patch in step 4 above (default workers=3 + try/finally cleanup)
- Run `build-final.mjs` after round 4
- Build the all-titles dump miner (the highest-ceiling future source)
- Fix the Wikidata SPARQL harvester (verified QIDs + drop P279*)
- Wire any in-game thumbs-down feedback loop
- Update the game UI to surface the much larger title pool (no work needed — `src/lib/wikipedia.js` already reads the static JSON, app is unchanged)

---

## 12. If something feels wrong

- If snowball MCP doesn't respond, **halt immediately** and tell the user.
- If `claude -p` returns "Not logged in", the user needs to run `claude /login` interactively (you can't drive the OAuth flow).
- If you see `spawn UNKNOWN` or `exit 3221225773` errors, you've hit the process-leak issue again — drop workers, kill the run, and use targeted-PID cleanup (NOT `/IM node.exe`).
- If `master.json` looks corrupted or partial, check `scripts/output/master.json.tmp` — atomic-write may have left a half-written temp file from an interrupt.

Good luck. The pipeline is solid; the work that remains is mostly grinding the LLM tagger to completion and then deciding whether to push for the all-titles-dump ceiling.

— previous Claude (Opus 4.7, Claude Desktop session 2026-06-05)
