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
- `docs/`      threat model, architecture, AI build log, drill-day runbook, the film's scene plan
- `video/`     the demo film, rendered from code with Remotion (own package, not a workspace)

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

Run from the repository root. Node 20 or newer.

| Command | What it does |
|---|---|
| `npm run dev` | the site at http://localhost:5173 (add `?mockwallet` to test the QoreX flow without the extension) |
| `npm run check` | compile contracts, typecheck, lint, all unit tests. Must be green before a commit |
| `npm test` | unit tests only |
| `npm run heist` | every attack with the published key (`--list`, `--only`, `--record`, `--json`) |
| `npm run status` | read both vaults, the owner account and its window from the chain |
| `npm run intruders` | the intruder file from the vault logs, with money trails (`--json`). Read-only |
| `npm run keeper -- --dry` | what the keeper would do now, changing nothing |
| `npm run keeper` | one keeper tick. Signs with the mnemonic in `.env`: Maria runs this, or the scheduled workflow does |
| `npm run keeper -- --rescue <0x…>` | the way out: shut the side door, move the two-lock vault's money to a fresh PQC-registered account. Maria runs this; `--dry` previews |
| `npm run watch` | alerts on new attempts to Telegram or Discord (`ALERT_*` in `.env`). Read-only; `--once`, `--dry` |
| `npm run deploy -w contracts` | deploy both vaults (already done; do not repeat without asking) |
| `npm run build` | contracts, then the site into `web/dist` |
| `npm run score --prefix video` | compose the film's original music to the scene lengths (`video/public/music/score.wav`) |
| `npm run video:timing` | only for an optional voiceover: fit scene lengths to files in `video/public/audio` |
| `npm run video` | render the demo film to `video/out/steal-this-vault-demo.mp4` (run `npm install` in `video/` first) |

Do not write test counts here: they go stale.

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
