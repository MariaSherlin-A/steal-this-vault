# contracts

The Solidity side of Steal This Vault.

| File | What it is |
|---|---|
| `src/QorePQC.sol` | fail-closed wrappers for the `pqcKeyStatus` and `pqcVerify` precompiles |
| `src/HybridAuth.sol` | dual-signed intents: secp256k1 (EIP-712 or the caller) plus ML-DSA-87 |
| `src/Vault.sol` | the vault. One immutable flag, `postQuantum`, separates the hybrid vault from the control |
| `src/examples/HybridAccount.sol` | the same library guarding a generic account |
| `scripts/compile.ts` | compiles with solc-js and writes the ABIs that `core` imports |
| `scripts/deploy.ts` | deploys both vaults to the testnet (needs `.env`) |
| `scripts/publish-key.ts` | writes the owner's secp256k1 key, and only that key, to `core/src/published.ts` |

```sh
npm run build -w contracts   # compile
npm run test -w contracts    # unit tests
```

The tests run on a local EVM (EthereumJS) with a real ML-DSA-87 implementation installed at
the two precompile addresses, so signatures are genuinely verified. They are not a substitute
for the live testnet: the deployed vaults were attacked there too (see the root README).
