# Drill day runbook

The fest's Q-Day drill: 18 Nov 2026, 00:00 to 23:59 UTC. A bot holds the owner's published
secp256k1 key and tries everything that key alone can do. Ranking: proof transaction first,
then fewest successful attacks, then most value kept.

Registered: owner account `0xA2E46aDe…dd73` (`qor15tjx…`) and the hybrid vault `0x877BA271…c483`.

All times UTC. India is UTC+5:30, so 00:00 UTC is 05:30 in India.

## 17 Nov, evening (before 23:59 UTC, that is before 05:29 on 18 Nov in India)

1. On GitHub: Settings, Secrets and variables, Actions, Variables, set `KEEPER_MODE` to `drill`.
2. At the computer, in the repo:
   ```sh
   npm run keeper -- --drill
   npm run status
   ```
   Status must show: EVM window **closed**, control vault holds **0 QOR**, no problems.
3. From 18:00 UTC the keeper forces drill mode by itself, so even if step 1 is forgotten the
   scheduled runs will only ever close the window and empty the control vault.

## 18 Nov, drill day

1. Any time between 00:00 and 23:59 UTC (05:30 on 18 Nov to 05:29 on 19 Nov in India), run:
   ```sh
   npm run keeper -- --proof-tx
   ```
   It prints `submit this hash on the project page: <hash>`. The transaction is a native
   payment of 0.01 QOR from the owner to the hybrid vault, signed with both keys. It needs no
   window. Do it in the middle of the day, not at the edges.
2. Paste the hash in the drill section of https://build.qorechain.io/p/steal-this-vault.
3. Check it on the explorer: https://explore.qore.network.
4. Do not run `npm run keeper` without `--drill` and do not open the window. The site will
   say the side door is shut; that is correct for the day.

## 19 Nov, after 06:00 UTC (11:30 in India)

1. On GitHub set `KEEPER_MODE` back to `normal`.
2. Run `npm run keeper` once; it reopens the window and refills the control vault.
3. Run `npm run status` and check for no problems.
4. Note the drill result in `docs/AI_LOG.md`.

## If something goes wrong

- `--proof-tx` fails: check the owner's liquid balance with `npm run status` (it needs about
  0.02 QOR), then retry. If the chain refuses, read the error; nothing else in the project
  depends on this transaction.
- The window is open on drill day: run `npm run keeper -- --close`, then `npm run status`.
- The control vault is not empty: run `npm run keeper -- --drill` again.
