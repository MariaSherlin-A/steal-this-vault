# Threat model

## What is protected

The QOR held by the hybrid vault (`0x877BA271…c483`) and the liquid balance of the owner
account (`0xA2E46aDe…dd73`) on the QoreChain testnet.

## The attacker

The attacker this project is built around **has the owner's secp256k1 private key**. That is
not an assumption: the key is published in `core/src/published.ts` and on the site. It stands
for what a quantum computer gives an attacker on Q-Day.

The attacker can therefore:

- sign any native-lane or EVM-lane transaction as the owner with the classical key
- read every public value on the chain, including the owner's ML-DSA-87 **public** key
- read every past transaction of the owner, including valid hybrid signatures
- generate ML-DSA-87 keys of their own
- send transactions from other accounts, deploy contracts, and call the vault from anywhere

The attacker does **not** have the owner's ML-DSA-87 secret key or the mnemonic.

## The three layers

| Layer | Enforced by | What it demands |
|---|---|---|
| Native lane | the chain's ante handler | the hybrid ML-DSA-87 signature on every transaction from an account with a registered key |
| EVM lane | the chain's EVM window check | an open authorisation window, opened with a hybrid signature, that lists the destination in `allowedTargets` |
| Vault | `Vault.withdraw` through the `pqcKeyStatus` and `pqcVerify` precompiles | an ML-DSA-87 signature, by the key on record for the owner, over this exact withdrawal |

## Attacks and outcomes

Every row is implemented in `core/src/attacks.ts` and runs from the site and from `npm run heist`.

| Attack | Outcome | Why |
|---|---|---|
| Native transfer with the classical key | refused by the chain | `pqc` code 20, hybrid signature required |
| Native transfer with a self-made ML-DSA-87 key | refused by the chain | the signature does not match the key on record |
| Replace the owner's ML-DSA-87 key | refused by the chain | changing the key needs the current hybrid signature |
| Open an EVM window | refused by the chain | opening a window is a native transaction, so it needs the hybrid signature |
| Grant another account spending rights (authz) | refused by the chain | same |
| Consent to EIP-7702 delegation | refused by the chain | same |
| EVM transfer of the owner's coins | refused by the chain | the destination is not in the window's `allowedTargets` |
| ERC-20 style approval | refused by the chain | same |
| Contract deployment | refused by the chain | a creation has no allowed target |
| EIP-7702 transaction | refused by the chain | needs hybrid consent |
| Move funds into the control vault, then rob it | refused by the vault | a scoped window limits targets, not value, so the vault itself rejects value sent by the owner account (`OwnerCannotDeposit`) |
| `withdraw` with no second signature | refused by the vault | `PqSignatureMalformed` |
| `withdraw` with random bytes of the right length | refused by the vault | `PqSignatureInvalid` |
| `withdraw` signed with the attacker's own ML-DSA-87 key | refused by the vault | the vault reads the owner's key from the chain, not from the caller |
| `withdraw` relayed through another account | refused by the vault | no classical authority (`NotAuthorized`) |
| Replay of the owner's last real withdrawal | refused by the vault | nonce already used, or deadline passed |
| A real signature reused for a new recipient | refused by the vault | recipient and amount are inside the signed bytes |
| Rob the control vault | **succeeds** | it has one lock. This is the control of the experiment |

## Replay and redirection

The ML-DSA-87 signature covers
`abi.encodePacked(PQ_DOMAIN_TAG, block.chainid, address(vault), signer, intent)`, where the
intent holds recipient, amount, nonce and deadline. A signature is therefore valid for one
vault, on one chain, for one payment, once, until its deadline. Anyone may submit a signed
intent; it can only pay the recipient the owner signed for.

## Failing closed

If `pqcKeyStatus` returns no key, a key of the wrong length or algorithm, or a key without
proof of possession, the vault refuses (`PqKeyUnavailable`). If a precompile call fails, the
wrapper in `QorePQC.sol` treats it as "not verified". The hybrid vault never falls back to the
classical check alone.

## Drill mode

In normal mode two things are given away on purpose: the control vault's small balance (it
is the control) and the window's fee allowance (the cost of recording attempts). During the
fest's Q-Day drill both would count as losses, so the keeper's drill mode removes them: it
empties the control vault back to the owner and shuts the window. Every attempt with the
published key is then refused at the door, for free.

An observation from building it: on this testnet, while the owner's window was shut, the
`ecrecover` precompile returned nothing for signatures by accounts with a registered
ML-DSA-87 key, though it worked for other keys. A relayed EIP-712 signature by the owner was
therefore refused by both vaults (`NotAuthorized`). This is not documented that we could
find, so the project does not rely on it.

## What is not covered

- **Leak of the mnemonic.** Both keys derive from it. It is kept in `.env` (ignored by git)
  and in GitHub Actions secrets, and nowhere else. Every commit's staged diff is scanned for
  it before committing.
- **Fee griefing.** Recorded attempts spend the owner's fee allowance in the window (the
  keeper opens it with a cap of 0.5 QOR and 400 transactions). An attacker can exhaust it.
  They gain nothing; the cost is bounded by the cap, and the keeper keeps 3 QOR in reserve
  and stops renewing below it.
- **Keeper failure.** No keeper, no window. The vault is then unreachable over the EVM for
  everyone using only the classical key, which is the safe direction.
- **The precompiles and the validator set.** The vault trusts the chain's ML-DSA-87
  implementation and its validators. This is a testnet.
- **ML-DSA-87 itself.** The project relies on the NIST standard (FIPS 204). It does not, and
  cannot, test it against a quantum computer.
- **The website.** The site holds no secret and cannot move funds. A tampered copy of the site
  could show false numbers; the contracts and the explorer are the source of truth.
- **Mainnet.** The precompiles are testnet only today. Nothing here should be used with real
  funds.
