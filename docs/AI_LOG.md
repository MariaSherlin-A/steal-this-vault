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
