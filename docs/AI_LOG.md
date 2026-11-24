# AI build log

How AI (Claude Code) was used to build Steal This Vault. Each entry says what was asked,
what the AI did, what was checked against the live testnet, and what went wrong.

## 13 Nov 2026: research, concept, phase 0 proof tests

**Asked:** check the fest is safe and free to enter, find an idea that fits Quantum Pass,
then prove the idea works before building.

**Research and concept**
- Read the fest rules, kits, docs and the four public entries.
- First concept ("publish a key, dare people to steal") had a gap: an attacker with the
  classical key can act inside an open EVM window. The concept was reworked so the vault
  contract itself demands an ML-DSA-87 signature, verified by the `0x…0A01` precompile.

**Proof tests on testnet `qorechain-diana`** (scripts in `spikes/`)

| Test | Result | Evidence |
|---|---|---|
| Register ML-DSA-87 key with proof of possession | Passed | tx `7158E0E5…65ED2E58` |
| Hybrid-signed payment, read back over REST | Passed | tx `22A3BC93…846FBE30`, carries `PQCHybridSignature` |
| Native transfer with the classical key only | Refused | `pqc` code 20, "hybrid PQC signature required" |
| Open an EVM window with the classical key only | Refused | `pqc` code 20 |
| EVM transfer and contract deploy, no window | Refused | "no open EVM authorisation window" |
| Contract verifies a valid ML-DSA-87 signature on chain | Passed | probe `0x033d6258…63fee481`, tx `0x128a7f5e…` |
| Contract counts a forged signature without reverting | Passed | tx `0xed3e8d68…`, counters `passed 1, failed 1` |

**What went wrong, and the fix**
- The first run of the classical-only attacks reported two attacks as *succeeding*. The
  cause was a bug in the test, not the chain: `signMode: "classical"` was passed per call,
  where the SDK ignores it, so the "thief" was still attaching the post-quantum signature.
  The chain's own `pqc_verify` event in the result exposed this. Fixed by building a
  separate classical-only signer; all four attacks were then refused.
- Solidity rejected the precompile addresses as written in the docs (`0x…0A01`) because of
  the checksum rule. Lower-case form compiles.

**Learned for the build**
- `pqcKeyStatus(address)` returns the same 2592-byte key the SDK derives, with
  `possessionProven = true`, so the vault can read the owner's key from the chain.
- EVM transactions were charged half their gas limit even when they used less, so gas
  limits must be set tight.
- Not yet tested: connecting the QoreX wallet from a web page.

## 13 to 14 Nov 2026: contracts, deployment, attack runner, keeper, site, docs

**Asked:** build the whole project from the proven concept: contracts with tests, a live
deployment, a way for anyone to attack it, a site that shows only real chain data, and the
documents a judge needs. Then: "complete the work within this session".

**What the AI did**
- Wrote `QorePQC`, `HybridAuth`, `Vault` and an example `HybridAccount`, and a unit-test
  harness: a local EVM with a real ML-DSA-87 implementation at the precompile addresses, so
  tests verify signatures for real.
- Wrote `core` (native lane, EVM lane, intents, the 18-attack catalogue and runner), the
  `heist` and `status` commands, and the keeper with its decision logic kept pure for tests.
- Deployed both vaults from a separate deployer account and published the owner's secp256k1
  key (and only that key) into the source.
- Built the site: hero with the key, two-vault comparison, attack lab that runs the same
  runner in the browser, the on-chain record, QoreX payment, technical details.
- Wrote the README files, threat model and architecture notes, CI and keeper workflows.

**Checked against the live testnet**
- `npm run heist -- --record`: 17 attempts refused, the control vault paid. The hybrid vault's
  own counters then read 5 refusals, 4 of them stopped by the post-quantum layer alone.
- `npm run status`: owner key registered with proof of possession; vault balances and
  counters match the explorer.
- The site, in a headless browser at 1440 and 390 px wide: no console errors, no sideways
  scroll, all figures filled from the chain. "Run all" in the browser: 17 refused, 1 control
  vault would pay (simulated, labelled as such, because the window had expired).
- The QoreX flow was exercised with the official mock wallet only. **Not yet tested with the
  real QoreX extension.**

**What went wrong, and the fix**
- **The window expired during the session.** The keeper is not scheduled until the repository
  is pushed and its secrets are set, so the owner's EVM window ran out. The site handled it
  honestly (shows "Closed", falls back to unrecorded checks), but two plain-language
  explanations were wrong for a closed window and were corrected. The AI tried to run the
  keeper itself to reopen the window; the safety layer blocked it because it signs with the
  mnemonic. Left for Maria to run.
- **A draft of the threat model was wrong** about one attack (moving funds into the control
  vault). It said the chain refuses it; the code and the earlier live run show the *vault*
  refuses it (`OwnerCannotDeposit`), because a scoped window limits targets, not value.
  Found by re-reading the runner before committing, and fixed in the README too.
- **First paint loaded 3 MB.** A manual chunk rule pulled the SDK into the entry page. Removed
  the rule; the SDK now loads only through the lab's dynamic import (first paint about
  160 kB gzipped).
- **A private key prefix was echoed** in a terminal command while reading `published.ts`.
  That key is public by design, but the rule is never to echo keys; later commands exclude
  that line. A script now scans each staged diff for the real secrets and prints only a count.
- **`npm run check` could not pass as first written:** no ESLint config existed, three
  workspaces had no tests, and two `test:live` scripts pointed at a folder that was never
  created. Config and tests were added; the dead scripts were removed rather than left
  looking like live tests exist.
- **Shell heredocs with several files failed to parse** three times and wrote nothing. The
  cause was never found; the fix was one file per command.
- Icons: no GitHub or chevron icon in the chosen free set, so links use text and the chevron
  is drawn in CSS rather than mixing icon families.

**Not done**
- The Q-Day drill (separate task, signup by 17 Nov).
- A test with the real QoreX extension and a real visitor payment.

## 14 Nov 2026 (evening): drill mode and a rehearsal of the Q-Day drill

**Asked:** close the weak spots before the fest's Q-Day drill, test it, then push.

**Weak spots found by reviewing the drill rules against the design**
- The one-lock control vault opens for the published key by design, so on drill day it
  would count as a successful attack and a loss.
- While the owner's window is open, each attempt spends the owner's fee allowance.

**Fix:** a keeper drill mode (`--drill` or `KEEPER_MODE=drill`) that empties the control
vault back to the owner and then shuts the window, plus `--proof-tx` for the drill's
"project still works" transaction. Unit-tested (plan is pure).

**What went wrong first.** The first version had the payer account relay the owner's signed
withdrawal. It was mined, but the vault recorded `NotAuthorized`. Probing showed that the
chain's `ecrecover` precompile returned nothing for both accounts that have an ML-DSA-87 key
(while their windows were shut), yet worked for random keys. The earlier proof-of-life
payout used the same path successfully while the owner's window was open. This behaviour is
not documented that we could find. Drill mode was changed so the owner calls the vault
itself, which does not depend on it.

**Rehearsal on testnet** (Maria ran the keeper, since it signs with the mnemonic; the safety
layer stopped the AI from doing so):
- Drill mode: window opened, control vault emptied (tx `0xe741fea0…8c4b06b4`), window closed.
- Then every attack with the published key: 17 refused (11 by the chain, 6 by the vault, the
  vault ones checked with a call because the door was shut), the control attack skipped
  because there was nothing to take. `npm run status`: no problems, control vault 0 QOR,
  window closed. Cost of switching to drill mode: about 0.09 QOR in fees.

## 16 Nov 2026: drill-day safety, the demo film

**Asked:** make every change needed for drill day and make sure it is safe now; write the
demo video script; build the film as an animated piece (not a screen recording) that takes
Maria's voiceover, scene by scene.

**Found while checking the site before the video.** The owner's window was closed although
the keeper workflow is scheduled every 15 minutes: GitHub ran it only every 5 to 7 hours
(`gh run list`), and a window lasted 3.9 hours. Fix: the keeper now opens 17,000-block windows
(about 6.6 hours, just under the chain's ceiling), so the side door is open most of the day.

**Drill-day changes.**
- The drill period (17 Nov 18:00 to 19 Nov 06:00 UTC, from the fest rules: 18 Nov 00:00 to
  23:59 UTC) is hard-coded in `keeper/src/plan.ts`. Inside it the keeper is in drill mode
  whatever `KEEPER_MODE` says; only `--normal` typed by a human overrides it. So the one step
  that could be forgotten (setting the variable) cannot open the window on drill day.
- `--proof-tx` says when it is run outside drill day, so a rehearsal is not mistaken for the
  real proof. The proof is a native payment, so it needs no window.
- `docs/drill-day.md`: the runbook for 17, 18 and 19 Nov, in UTC and Indian time.
- Tests for the forced period; `npm run check` green.

**The film.** `video/` is a Remotion project (React rendered frame by frame, encoded with
FFmpeg), kept out of the root workspaces so the keeper's install stays small. Eight scenes
pace themselves against their own length, so the pictures follow the voice however fast it
is read. `scripts/timing.mjs` measures each voice file with ffprobe and sets the scene
lengths; a scene without a file plays silent at the script's estimate. The record scene
shows real figures from `npm run status` with the date they were read, per the rule that no
simulated number is shown as live. Verified with stills of every scene and a full silent
half-size render. Fixed from the stills: a block strip that wrapped to a wrong block number,
an overlapping footer, and a closing line that crowded the one-lock vault.

**Still open.** Maria records the eight voice files; then `npm run video:timing` and
`npm run video`. QCAI stage 2. A Hardhat or Foundry test suite for the category.

## 17 Nov 2026, evening: the intruder file

**Asked.** Start on the extra features discussed earlier: first the intruder file and money
trail on the site, then alerts, then the one-click rescue. Video and audio wait until Maria
says so.

**Done.** `core/src/history.ts` reads every `Refused` and `Paid` event from each vault's
deployment block (the RPC allows 10,000 blocks per request, so it pages; checked that the
testnet still serves logs from block 10,054,281) and builds the file: one entry per wallet
the money was meant for, with methods, amounts wanted and taken, callers, and the project's
own accounts named instead of passed off as strangers. `core/src/trail.ts` follows a wallet's
money over the native lane's `transfer` events: first funding, then the largest payment hop
by hop, then what the last wallet holds. `npm run intruders` prints it; the site has a new
section after The record, kept in the browser between visits and reread when the counters
move. Tests use the real decoded events as fixtures and a fake ledger for the trail.

**Found.** A contract's payment inside an EVM transaction is recorded as coming from the
chain's EVM module account (`qor1vqu8r…jhp2`), not from the contract. The thief's loot
therefore "came from" that address; it is labelled as a vault paying out.

**Verified.** `npm run check` green; `npm run intruders` live against the testnet matches
the counters (2 wallets, 5 refusals, 1 robbery of 0.01 QOR, loot still in the stranger's
wallet). Section checked at 1440 and 390 through Chrome's DevTools protocol, since the
browser extension was not connected.

**Still open.** Alerts when the leaked key is used (channel to be chosen by Maria), the
rescue command, the voiced video.

## 17 Nov 2026, later: the warning and the way out

**Asked.** Carry on with the extra features: alerts, then the rescue.

**Done.** `core/src/alerts.ts` turns a new attempt into a plain-words message (what happened,
which vault, how much, where the money was to go, who sent it, the explorer link) and posts
it to a Telegram bot or a Discord webhook; a burst becomes one digest. `npm run watch`
(keeper package, but it holds no mnemonic) looks every 20 seconds from the last block it
saw, kept in `keeper/.watch.json` (ignored by git). Dry-run over the robbery blocks printed
the seven real attempts correctly; nothing was sent, since no channel is set yet. The
channel is Maria's choice.

`npm run keeper -- --rescue <0x…>`: refuses the owner account, the deployer, a vault, an
account without a registered post-quantum key, or an empty vault (pure checks in
`plan.ts`, tested); otherwise shuts the owner's side door and withdraws the whole two-lock
balance to the new account, signed with both keys and relayed by the payer, the same path
proof of life already uses live. Live dry run against an unregistered address: refused with
the right message. The full rescue has not been run: it would empty the vault that the
experiment depends on. It can be rehearsed on drill day's eve only if Maria wants.

**Verified.** `npm run check` green. README and CLAUDE.md updated.

**Open.** Maria picks Telegram or Discord and fills `.env`; where the watcher runs (a laptop
that stays on, or a small server); the voiced video; QCAI stage 2.

## 18 Nov 2026: drill day check, and the site gets views and a replay

- **Asked:** how the drill went; then, after Maria found the site slow to navigate and the
  record confusing ("what is robbed?"), make it feel automatic and alive, and fix the menu.
- **Drill so far (read from the chain at 17:33 UTC):** window closed, control vault empty,
  no new attempts on either vault, all three scheduled keeper runs in the drill period
  succeeded. Maria ran `--proof-tx`; it landed at 17:30:48 UTC, block 10,328,183, code 0,
  0.01 QOR to the two-lock vault, signed with both keys.
- **Found:** the "Latest attempts" list called the keeper's clean-out of the bait vault
  "Robbed", because it only knew the sender, not where the money went. Misleading.
- **Did:** each menu item now opens its own view (no long smooth scroll), with a tab strip on
  phones, where the menu used to be hidden. A replay on the home view plays back the latest real
  attempts from the vault logs, lock by lock, labelled as a replay. The record list reads the
  full history and says "The owner took the bait money back. Not a theft." Live figures count up.
- **Went wrong:** two keeper tests failed because they used today's date, which is inside the
  forced drill period. The keeper was right; the tests now pin an ordinary date.
- **Verified:** `npm run check` green; screenshots at 1440 and 390 of home, replay, record and
  header. Not deployed: Maria chose to wait until after the drill.

## 19 Nov 2026: the voiced demo film

- **Asked:** finish the demo film with a narrator, high quality, modern type and motion, in the
  Quantum blue palette; voice it with Edge's neural voice "Andrew"; use the GPU.
- **Went wrong first:** ElevenLabs refused generation on the free tier; Hume was never
  connected; a local model (Kokoro) needed a large download Maria had not approved. Maria then
  chose Edge "Andrew" via `edge-tts`. A narrator from another team's video was not cloned.
- **Did:** `video/scripts/voice.py` voices the 13 lines (spoken text adjusted only for
  pronunciation: "Core Chain", "M L D S A eighty-seven"), loudness-matched to -16 LUFS.
  `npm run timing` fitted every scene to its recording and timed the subtitles to the pauses.
  Per-scene `lead` and `hold` in `timing.json` give the title and the close room to breathe.
  New for the whole film: a blur-and-zoom cut with a light sweep into every scene, a slow
  camera push, a quiet frame overlay with a progress line, subtitles on a glass bar that light
  up word by word with danger words in red and the answer in cyan, and a whoosh on every cut
  in the score. Rendered in Chrome's GPU mode (`--gl=angle`) on the RTX 2050.
- **Verified:** figures re-read with `npm run status` (unchanged: 10.007 QOR held, 5 refused,
  control vault paid 3 times); stills checked across all 13 scenes at half and full size;
  film length 2:44, under the 3 minute limit. Two files: with subtitles, and clean.

## 25 Nov 2026: the Paper & Ink website redesign

- **Asked:** a new site taking UI/UX inspiration from a Webflow fashion template (loader,
  poster type, full-screen numbered menu, scrolling strips, framed hero, a colour switch), in a
  new palette, high-end motion, no "AI look", catchier taglines, every feature explained in plain
  words. Plan first; Maria set it as the goal. GSAP and Lenis installed after she approved.
- **Did (branch `redesign/paper-ink`):** "Paper & Ink" palette (paper, ink, violet, mint for
  refused, carmine for robbed), Archivo wide caps, IBM Plex, JetBrains Mono labels. One story
  page with numbered sections: the key, two locks (pinned scroll: the stolen key opens lock one,
  lock two refuses), replay, scoreboard (both vaults side by side plus the counterfactual loss),
  Q-Day drill (Today / Q-Day switch, and the 18 Nov proof payment read back from the chain live:
  accepted, carries the second signature), alerts and rescue (the watcher's message built from
  the latest real attempt; side door and rescue amount live). Attack lab, intruders and technical
  pages kept their logic with new heads. The loader climbs with real steps (fonts, first chain
  answer) and lets the visitor in after 4.5 s if the chain is slow. Nothing in the reference was
  copied: code, words and drawings are new.
- **Went wrong:** the header's class name `.bar` clashed with the scoreboard rows and broke the
  header; renamed. A difference-blend header turned olive over the violet band; replaced with a
  header that reads the background under it. The phone Technical page overflowed on long
  addresses (grid children could not shrink); fixed with `min-width: 0`. "160.1 h ago" became
  "6.7 days ago". Screenshot tool: Chrome headless driven over the DevTools protocol from Node.
- **Verified:** `npm run check` green; `vite build` ok; screenshots of every section at 1440 and
  390, no horizontal overflow at either width. Not pushed, not deployed.
- **Found later the same day:** a fresh full screenshot pass showed the alert card empty and the
  intruder page stuck loading. Cause: the replay, scoreboard and alert sections each ran their own
  full history read (three heavy log reads at once on a first visit), and changing page started
  another. Fixed with one shared `HistoryProvider`; the pages also say what they are loading.
  Verified on a fresh browser profile: home loads its history, then the intruder page opens with
  both cards at once. One live attack run from the lab with recording off: refused by the chain.

## 25 Nov 2026: clearer site after Maria's review

- **Asked:** after reviewing the site, Maria found the intruder page hard to read, "No catch"
  unclear, the locks scene tied to scrolling, the replay slow, the drill win under-sold, the alert
  card too small, and the lab's one "Would pay" confusing. She also asked whether the honest
  limits belong on the site, and what would make the project more useful.
- **Did:** a new attack, `vault-twin-robbery`, makes the exact robbery that empties the one-lock
  twin against the two-lock vault (in the shared list, so `npm run heist` has it too). The lab
  scorecard now counts the vault alone, "18 of 18 refused · 0 QOR lost", with the twin shown as a
  labelled comparison. A "Survived Q-Day" banner finds the drill's 24 hours as a block range from
  block times and counts the vault's record in it. Intruder cards lead with one plain sentence and
  a tally. The locks scene plays by itself; the replay runs twice as fast with verdict stamps.
  Every section intro rewritten. Limits stay on the Technical page, each with how it is handled,
  plus a short "use the second lock in your own app" section pointing at HybridAccount.sol.
- **Verified live (recording off):** the new attack is refused by the vault (PqSignatureMalformed)
  while the twin would pay; the lab run reads 18 of 18 refused, 0 QOR lost; the drill range is
  blocks 10,284,029-10,344,546 with 0 thefts, 0 QOR lost, owner in. `npm run check` green;
  screenshots of every changed section at 1440 and 390, no horizontal overflow.
- **Went wrong:** "SURVIVED Q-DAY" broke at its hyphen, and the replay stamp covered the vault's
  name; fixed with a non-breaking hyphen and by centring the stamp on the door. The lock labels
  were unreadable on phones; a legend replaces them there.
- **Noticed:** the side door (EVM window) was shut during this session, so the keeper had not
  renewed it. Renewing signs with the mnemonic, so it is Maria's step.

## 25 Nov 2026: the second film, recorded from the live site

- **Asked:** a new demo film (under 3 minutes) recorded from the Paper & Ink site, in its palette,
  explaining every section and the project's unique details, opening with the real problem
  (illustrations plus open-licence images, statistics only with a source), voiced by Edge
  "Andrew", high quality at 60 fps; script shown to Maria and approved before voicing.
- **Did:** a frame-exact recorder (video/capture/rec60.mjs) drives Chrome's headless shell one
  frame at a time, so site animations come out perfectly smooth at 60 fps while live chain reads
  arrive in real time. Every site shot is scripted (capture/shots.mjs); the attack lab ran all 19
  attacks live with recording off: 18 of 18 refused, 0 QOR lost, the twin would pay. Scene 1 is
  drawn in code (phishing, malware, a careless backup, the public ledger) with Chainalysis's
  $3.4B (2025) figure and its source on screen; scene 2 uses one photo, IBM Quantum System One
  by IBM Research (CC BY 2.0), downloaded with Maria's permission and credited. Voice with word
  timings (scripts/voice-film.py), an original score to the same timings, word-lit subtitles.
- **Went wrong, and fixed:** the recorder first stalled waiting on Chrome's virtual-time signal;
  count-ups showed negative numbers because animation timestamps and the page clock disagreed
  (fixed by handing animation callbacks the page clock); every CSS transition was frozen because
  frame times started before the page's animation origin (fixed by raising the start). Clips first
  began under the opening loader, so the recorder now lets it finish off camera. The replay on the
  site cycled through the owner's own withdrawals, which contradicted "Watch them fail": the site
  now replays only break-in attempts (same rule as the alerts).
