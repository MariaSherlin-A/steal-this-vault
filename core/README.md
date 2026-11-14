# core (`@stv/core`)

The shared library. The CLI, the keeper and the site all import it, so an attack run in the
browser is the same code as an attack run from a terminal.

| Module | What it is |
|---|---|
| `chain` | testnet endpoints, precompile addresses, units, explorer links |
| `deployments` | the deployed addresses, from `deployments/testnet.json` |
| `refusal` | the vault's refusal reasons, in plain and technical words |
| `intent` | builds and signs withdrawal intents (both layers) |
| `native` | the native lane over REST: balances, key status, windows, sending transactions |
| `evm` | the EVM lane over viem: vault reads, sending with a secp256k1 key, reading a node's refusal |
| `attack-list` | the catalogue of attacks: descriptions only, safe to load on first paint |
| `attacks` | the runner. Never throws; returns a verdict and the refusing party's own words |
| `published` | the owner's secp256k1 private key. Public on purpose |

`published.ts` is the only key material in the repository. The owner's ML-DSA-87 key and the
mnemonic are not here and must never be.

```sh
npm run test -w core
```
