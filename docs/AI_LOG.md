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
