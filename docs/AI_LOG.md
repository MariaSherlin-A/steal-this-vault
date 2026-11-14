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
