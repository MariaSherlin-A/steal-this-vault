# QCAI audit

Two-stage audit with the QCAI AI Security Auditor on dashboard.qorechain.io (testnet), as
the Post-Quantum dApp category asks: run the auditor, assess and fix the findings, run it
again.

## Stage 1 (15 Nov 2026)

- Report: `QoreChain_Audit_Steal This Vault_1794681090683.pdf`, generated 15 Nov 2026, 00:01
- Input: [audit/StealThisVault.flat.sol](audit/StealThisVault.flat.sol) at commit `ce78a3b`:
  `QorePQC.sol`, `HybridAuth.sol` and `Vault.sol` from `contracts/src`, merged in that order,
  OpenZeppelin Contracts 5.6.1 left as imports. This is the source of the deployed vaults.
- Chain setting: Ethereum (EVM/Solidity), because QoreChain EVM is not in the auditor's list.
- Result: score **82/100**, risk MEDIUM. 5 findings: 1 high, 2 medium, 1 low, 1 info.

The line numbers in the report match neither the merged file nor `Vault.sol`, so each finding
below was matched to the code by its description.

| Severity | Finding | Assessment | Change |
|---|---|---|---|
| High | Missing access control on owner deposit (`receive`) | **By design.** Anyone may add QOR to the vault: the site's "Raise the stakes" feature depends on it, and a deposit can only add to what the thief cannot take. The one account that is refused is the owner (`OwnerCannotDeposit`), on purpose: a window scoped to the vault limits where the owner account may send, not how much, so a vault that accepted the owner's EVM value and paid it out on classical authority would be a forwarder for the owner's liquid balance. Test: `vault.accounting` "anyone but the owner can add QOR". | None |
| Medium | Potential overflow in counter updates | **Not reachable, and safe if it were.** The counters are `uint64` (18.4 × 10¹⁸). At one recorded attempt per 1.4 s block they would take about 800 billion years to fill. Solidity 0.8 checks arithmetic, so an overflow would revert the attempt, not wrap a counter, and no counter guards money. | None |
| Medium | Front-running of withdrawals | **Covered by design.** Both signatures cover recipient, amount, nonce and deadline, bound to the chain id and vault address. A copy of a valid withdrawal sent first can only cause the same payment to the same recipient; the original is then refused as a replay (`WrongNonce`). Tests: `vault.paid` "a copy of a valid withdrawal sent first causes the same payment, and the original is then refused"; `vault.refused` "the owner's signature moved onto a different recipient or amount" and "the owner's real signature for a different amount, recipient, nonce or deadline". | None |
| Low | Unbounded loop in `recent()` | **False positive.** The loop runs `min(cursor, RECENT)` times, and `RECENT` is the constant 16. It is a `view` function that writes nothing. Test: `vault.accounting` "recent() keeps the last 16 once the ring wraps". | None |
| Info | No ERC20 or ERC777 support | **Not applicable.** The vault holds the chain's native coin (QOR) on purpose; the experiment is about who can move it. | None |

The report also shows "Quantum Safety Score: 0%". Every withdrawal from the hybrid vault is
checked on chain with `pqcVerify` (ML-DSA-87) against the key read from `pqcKeyStatus`, which
the Ethereum setting cannot know about. Another fest entry saw the same 0% and found the
auditor returns no value for it, so we read it as missing, not as a result.

**Why no redeploy.** No finding pointed at a defect, so the deployed contracts stay as they
are. That keeps the public record of attempts intact and keeps the address registered for the
Q-Day Drill valid.

## Post-quantum design

The auditor's EVM setting cannot see QoreChain's precompiles, so this is where the vault's
post-quantum protection is, and which tests cover it.

| Where | What it does | What it protects |
|---|---|---|
| `QorePQC.keyOf` (`QorePQC.sol`) | calls `pqcKeyStatus(address)` at `0x…0A02` and decodes the owner's registered ML-DSA-87 key | the vault never stores a key of its own: it always checks against the key the chain has on record for the owner, so a key rotation on chain applies at once |
| `QorePQC.isUsable` | accepts only a registered ML-DSA-87 key with proof of possession | a missing, unproven or wrong-algorithm key fails closed (`PqKeyUnavailable`), never open |
| `QorePQC.verify` | calls `pqcVerify(bytes,bytes,bytes)` at `0x…0A01` | anything other than a well-formed `true` counts as a failed check |
| `HybridAuth._postQuantumLayer` | checks the signature length, then verifies it over `hybridSignBytes`, which binds the intent to the chain id and the vault | a signature for another amount, recipient, nonce, deadline, vault or chain is refused |
| `Vault._judge` | order: deadline, nonce, classical key, then post-quantum (only in the two-lock vault) | the published classical key alone ends at `PqSignatureMalformed` or `PqSignatureInvalid`; no money moves |

On top of the contract, the owner account sends EVM transactions only through a **scoped EVM
window** limited to the two vaults, renewed by the keeper. Outside it, the chain refuses
the published key before the vault is reached.

Tests (`contracts/test`, run on a local EVM that executes a real ML-DSA-87 implementation at
the precompile addresses):

- `vault.refused` "post-quantum layer": no signature, wrong length, zeros, one flipped bit,
  the thief's own ML-DSA-87 key, the thief registering a key on their own account, the
  owner's real signature for a different amount, recipient, nonce or deadline.
- `vault.refused` "fail closed": every way the owner's key can be unreadable, and the verify
  precompile not being active, even with the owner's real signature.
- `vault.refused` "domain separation" and "order of checks"; `vault.rotation` (key rotation);
  `vault.property` (random tamperings of a valid withdrawal); `experiment` (the same key
  against both vaults).
- Live: `npm run heist` and the site's attack lab, against the deployed vaults.

## Stage 2

To be run on the same source after this assessment, and recorded here.
