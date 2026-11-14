# keeper

The one process that holds the owner's mnemonic. It runs on a schedule
(`.github/workflows/keeper.yml`) and keeps the experiment open to visitors.

Each tick reads the chain, decides in `src/plan.ts` (pure, unit-tested) and acts in
`src/tick.ts`:

- **Renew the EVM window** when it is close to its limits. The window is scoped to the two
  vaults: 10,000 blocks, 400 transactions, 0.5 QOR of fees.
- **Refill the control vault** after it has been robbed, so the next visitor can rob it too.
- **Proof of life**: now and then, withdraw a little from the hybrid vault with both keys,
  so the record shows the vault does pay its owner.
- **Stop** when the owner's balance nears its 3 QOR reserve.

```sh
npm run keeper -- --dry     # read and decide, change nothing
npm run keeper              # act
npm run keeper -- --close   # close the window and stop (maintenance)
npm run keeper -- --drill   # drill mode, see below
npm run keeper -- --proof-tx  # one normal payment from the owner, signed with both keys
```

## Drill mode

For the fest's Q-Day drill, where a bot holds the published key and every successful attack
or lost coin counts against the project. Set the repository variable `KEEPER_MODE=drill`
(or pass `--drill`). Each tick then:

1. empties the one-lock control vault back to the owner (it opens for the published key by
   design, so on drill day it would only be a loss), opening the window for that one
   transaction if needed;
2. shuts the owner's window, so every attempt is refused at the door and costs the owner
   nothing;
3. never refills the control vault and never withdraws from the hybrid vault.

After the drill, `--proof-tx` makes the "project still works" transaction; then set
`KEEPER_MODE=normal` and the next tick reopens the window and refills the control vault.

Secrets, from `.env` locally or GitHub Actions secrets: `VAULT_MNEMONIC`, `DEPLOYER_MNEMONIC`.
Testnet accounts only. The keeper never prints them.
