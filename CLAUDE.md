# Steal This Vault

Entry for Build Before Q-Day (QoreChain Developer Fest). A vault on the QoreChain
testnet whose owner's classical (ECDSA) private key is published on purpose. Withdrawals
need a fresh ML-DSA-87 signature verified on chain, so the published key is not enough.
A public attack lab lets anyone try, and the contract counts the failures.

Owner: Maria (solo, student, new to web3). Explain web3 terms in plain words when reporting.

## Hard deadlines (UTC)

- 17 Nov 2026 23:59: Q-Day Drill signup (vault must be live on testnet)
- 18 Nov 2026: drill day; one normal transaction from the drill account, hash submitted by 19 Nov
- 2 Dec 2026 23:59: submission (aim to be done 1 Dec)

## Secrets: the one rule that must never break

- The vault owner's **ECDSA private key is public by design**. It may appear in the web app.
- The **mnemonic and the ML-DSA-87 secret key are never public**. Both keys derive from the
  mnemonic, so leaking it defeats the whole project.
- Secrets live only in `.env` files (gitignored) and GitHub Actions secrets.
- Never print a mnemonic or PQ secret key in chat, logs, commits, test output or screenshots.
- Before every commit: `git status` and check no `.env`, key file or mnemonic is staged.
  Then search the staged diff for the real secret values (first words of the mnemonic, start
  of the PQ secret key), because a secret can hide in a file with an innocent name.
- Testnet only. Never use an account that has held mainnet funds. Never touch mainnet.

## Network (testnet `qorechain-diana`)

- EVM chain id `9800`, EVM RPC `https://evm-testnet.qore.host`
- REST `https://api-testnet.qore.host`, RPC `https://rpc-testnet.qore.host`
- Explorer `https://explore.qore.network`, faucet `https://dashboard.qorechain.io/faucet`
- Precompiles: PQC Verify `0x…0A01`, PQC Key Status `0x…0A02` (testnet only, not mainnet)
- Native amounts are `uqor` (6 decimals); EVM amounts use 18 decimals
- EVM transactions need a registered PQC key and an open EVM window (max 17,280 blocks, 1,000 txs)
- Docs: https://docs.qorechain.io. Check the docs before guessing an SDK function name.

## Layout

- `spikes/`    phase 0 proof scripts (throwaway, kept as evidence)
- `contracts/` vault, PQ guard, tests (Hardhat)
- `keeper/`    window renewal and proof-of-life script
- `web/`       the site (scaffolded with `create-qorechain-dapp`)
- `cli/`       heist attack runner
- `docs/`      threat model, architecture, AI build log

## Working rules

- Verify against the live testnet before claiming something works. Hardhat cannot run the
  precompiles: unit tests use a mock, live tests run on testnet. Say which kind passed.
- State limits honestly in the README (testnet only, fee griefing, keeper dependency).
- Only tick a kit or network feature on the fest page if it is really in the code.
- Projects must be built during the fest: no copied code. Credit libraries and kits in the README.
- Licence: MIT, with a LICENSE file.

## Git

- Small commits, one logical change each, conventional prefixes (`feat:`, `fix:`, `docs:`,
  `test:`, `chore:`). Never one big dump.
- Push only when Maria says so.
- Keep the AI co-author line on commits (supports the AI-Native award, and is honest).

## AI build log

After each working session, append a dated entry to `docs/AI_LOG.md`: what was asked, what
the AI did, what was verified, what went wrong. This is evidence for the Best AI-Native Build
award, so record failures and corrections too.

## Commands

None yet. Add a row here the moment a real command exists (run, test, deploy, keeper), so
nobody has to guess. Do not write test counts here: they go stale.

## UI bar

- Premium, original design. No emoji as icons, no generic template look.
- **Never present simulated or placeholder data as live.** Every number on screen comes from
  the chain, or is clearly labelled as an example. Judges will check, and a fake counter
  would undo the project's whole claim.
- A UI change is not done until it has been checked in screenshots at desktop width (1440)
  and phone width (390).

## Words on the site

Visitors may know nothing about crypto. Main pages use plain words: vault, key, lock, thief,
refused, proof. Terms like ML-DSA-87, precompile, EVM window and hashes appear only inside a
"Technical details" area, where judges can find them.
