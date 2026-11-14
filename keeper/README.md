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
```

Secrets, from `.env` locally or GitHub Actions secrets: `VAULT_MNEMONIC`, `DEPLOYER_MNEMONIC`.
Testnet accounts only. The keeper never prints them.
