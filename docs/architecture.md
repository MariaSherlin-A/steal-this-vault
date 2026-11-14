# Architecture

```
                         QoreChain testnet (qorechain-diana, EVM 9800)
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  native lane                         EVM lane                                │
  │  ante handler: hybrid signature      window check: open? target allowed?     │
  │  required for the owner account      ┌──────────────┐   ┌──────────────┐     │
  │                                      │ Vault        │   │ Vault        │     │
  │  pqc module: owner's ML-DSA-87 key   │ postQuantum  │   │ postQuantum  │     │
  │  (with proof of possession)  ◄───────│ = true       │   │ = false      │     │
  │        ▲   precompiles 0x…0A02 / 0x…0A01              │   (the control)│     │
  └────────┼─────────────▲──────────────────▲─────────────────────▲──────────────┘
           │             │                  │                     │
     hybrid-signed   published key      published key          reads only
     transactions    (refused)          (refused / counted)
           │             │                  │                     │
      ┌────┴────┐   ┌────┴──────────────────┴───┐          ┌──────┴──────┐
      │ keeper  │   │ attack runner (core)      │          │ site, status│
      │ (cron)  │   │ used by the CLI and site  │          │             │
      └─────────┘   └───────────────────────────┘          └─────────────┘
```

## Packages

| Package | Role | Holds a secret? |
|---|---|---|
| `contracts` | Solidity sources, compile script, deploy script, unit tests | deploy script reads `.env` |
| `core` (`@stv/core`) | chain settings, native lane (REST), EVM lane (viem), intent signing, attack catalogue and runner | only the **published** key |
| `cli` | `heist` and `status` | no |
| `keeper` | one tick: read, decide (`plan.ts`, pure and unit-tested), act (`tick.ts`) | yes, the mnemonic, from the environment |
| `web` | the site | no |

## Contracts

- **`QorePQC.sol`**: thin wrappers around the two precompiles. `keyOf(address)` reads the
  registered key; `verify(pubkey, signature, message)` checks an ML-DSA-87 signature. A failed
  or malformed precompile answer is treated as "no key" or "not verified".
- **`HybridAuth.sol`**: dual-signed intents. The classical layer is an EIP-712 signature or
  the caller being the signer; the post-quantum layer is ML-DSA-87 over
  `PQ_DOMAIN_TAG ‖ chainid ‖ contract ‖ signer ‖ intent`.
- **`Vault.sol`**: one bytecode, one immutable flag (`postQuantum`). `withdraw` judges the
  attempt in a fixed order (deadline, nonce, classical authority, key available, signature
  well-formed, signature valid). It pays, or records the first failing reason. It keeps
  totals per reason, a ring of the last 16 attempts, and `counterfactualLoss`.
- **`examples/HybridAccount.sol`**: the same library guarding a generic account, to show the
  pattern is reusable.

**Why count instead of revert.** A revert leaves no trace. The point of the project is
evidence, so a refusal is a successful transaction that writes down what was tried. The state
change is limited to counters; the money moves only on the paying path, which follows
checks-effects-interactions and is covered by a reentrancy test.

**Why two vaults.** A vault that is never robbed proves little by itself: perhaps nobody
tried. The control vault is the same code with the flag off, attacked with the same key in
the same run. One pays and one does not.

## The attack runner

`core/src/attack-list.ts` holds only descriptions (plain and technical), so the site can list
the attacks without loading the SDK. `core/src/attacks.ts` runs them and never throws: each
attack returns a verdict (`refused`, `succeeded`, `skipped`), who refused, the refusing
party's own words, and how it was checked:

- `broadcast`: signed and sent to a node, which refused it
- `on-chain`: mined; the vault's answer is in the transaction and its counters
- `simulated`: `eth_call` against live state, with the real precompile; nothing is written

Vault-level attempts are recorded on chain only when asked (`--record`, or the switch on the
site), because each one spends the owner's fee allowance.

## The site

- **Reads.** Vault counters and the last attempts come from the EVM RPC every 6 seconds
  (paused in a hidden tab). The owner's window and balance come from the native REST API.
  That API sends no CORS headers, so the site calls `/lcd/*` on its own origin, which Vite
  (development) and `vercel.json` (production) forward to the testnet endpoint.
- **First paint stays small.** The page imports only light modules. The SDK and the ML-DSA-87
  code sit behind one dynamic import (`web/src/lib/lab.ts`), loaded after first paint and
  when the lab is first used.
- **No invented numbers.** Until a value has been read it is a grey placeholder. If the chain
  cannot be reached, the last real values stay and the header says they are stale.
- **Plain words.** `web/src/lib/explain.ts` maps each result to a sentence for someone who
  has never used a blockchain. The exact node message, code and transaction are under
  "Details", and protocol terms live in the "Technical details" section.
- **QoreX.** The visitor can connect QoreX and send testnet QOR into the hybrid vault. The
  page builds a `MsgSend` (encoded by hand in `msgSend.ts`, tested byte for byte against the
  SDK's encoder) and QoreX signs it with both of the visitor's keys. The page never sees a key.

## The keeper

Runs on a schedule (GitHub Actions). Each tick reads the chain and decides, in `plan.ts`:

1. renew the EVM window when it is close to its block, transaction or fee limit (10,000
   blocks, 400 transactions, 0.5 QOR of fees, scoped to the two vaults)
2. refill the control vault when it has been robbed below 0.02 QOR
3. from time to time, make a small withdrawal from the hybrid vault with both keys, so the
   record shows the vault does pay its owner
4. stop spending when the owner's balance nears its 3 QOR reserve

The withdrawal is signed by the owner and submitted by a separate payer account, so it does
not spend the window's allowance.

## Secrets

| Secret | Where | Used by |
|---|---|---|
| Owner secp256k1 key | public, `core/src/published.ts` | attack runner |
| `VAULT_MNEMONIC` (derives both owner keys) | `.env`, GitHub Actions secret | keeper, deploy script |
| `DEPLOYER_MNEMONIC` (deployer and payer account) | `.env`, GitHub Actions secret | keeper, deploy script |

The site and the CLI need none of them.
