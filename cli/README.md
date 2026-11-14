# cli

Two commands. Neither needs a wallet, an account or a secret.

## heist

Tries to rob the vault with nothing but the published key.

```sh
npm run heist                                  # every attack
npm run heist -- --list                        # what each attack does
npm run heist -- --only vault-forged,evm-transfer
npm run heist -- --record                      # write vault-level attempts to the chain
npm run heist -- --json                        # machine-readable
npm run heist -- --loot 0xYourAddress          # where stolen funds would go
```

Without `--record`, attempts that reach the vault are checked with `eth_call` against live
state and labelled as simulated. With it, they are mined and the vault counts them; that
spends the owner's fee allowance, so use it sparingly.

Exit code 0 means every attack got the expected answer (refused, or paid for the control).

## status

Reads both vaults, the owner account and its EVM window from the chain.

```sh
npm run status
npm run status -- --json
```

Exit code 1 means something is wrong with the experiment itself: the owner has no
post-quantum key on record, or the hybrid vault is empty.
