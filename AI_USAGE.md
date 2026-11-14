# AI usage

Steal This Vault was built by one student, Maria Sherlin A, working with an AI coding agent:
**Claude Code** (Anthropic), using Claude models, in VS Code on Windows. This file explains
the workflow, what the AI generated, and what the human did. The day-by-day record, including
mistakes, is in [docs/AI_LOG.md](docs/AI_LOG.md).

## Workflow

1. **Rules first.** [CLAUDE.md](CLAUDE.md) gives the agent standing rules: testnet only, never
   print or commit the mnemonic or the post-quantum secret key, verify on the live testnet
   before claiming anything works, never show simulated data as live, small commits, push only
   when Maria says so.
2. **Prove before building.** The agent wrote throwaway scripts in `spikes/` to test the idea
   on the live testnet (key registration, hybrid signing, classical-only attacks, `pqcVerify`
   from Solidity) before any product code was written.
3. **Build in small steps.** Contracts, then their tests, then the shared library, CLI,
   keeper and website. Each step ends with `npm run check` and a commit carrying an AI
   co-author line, so the history shows which commits were AI-assisted (all of them).
4. **Check against reality.** Claims are verified on the testnet: attacks run live, numbers on
   the site read from the chain, the site screenshotted at 1440 and 390 px wide in a real
   browser.
5. **Log everything.** After each session the agent appends to `docs/AI_LOG.md`: what was
   asked, what was done, what was verified, what went wrong.

## What the AI generated

- The Solidity contracts (`QorePQC`, `HybridAuth`, `Vault`, `HybridAccount`) and the test
  harness that runs a real ML-DSA-87 implementation at the precompile addresses.
- The TypeScript library, the 18-attack runner, the `heist` and `status` CLIs, the keeper
  and its drill mode.
- The website (React, plain CSS), the cover image, the README files, the threat model and the
  architecture notes.
- Research: the fest rules, QoreChain docs and kits, and the other public entries.

## What the human did

- Chose the fest and the category, and approved the concept and its rework (the first idea
  had a gap the agent found, see the log).
- Holds every secret. The mnemonics live only in a git-ignored `.env` on Maria's computer and
  in GitHub Actions secrets, which she added herself. They were never printed in the chat,
  logs or commits; every staged diff is scanned for them before committing.
- Signed every transaction that needed the owner's keys: the AI's safety layer blocked the
  agent from running the keeper, so Maria ran it (window renewal, drill-mode rehearsal).
- Reviewed the site and pushed back on design and wording ("I don't see anything happening",
  "I don't like the tagline"), which led to changes.
- Decided when to push, deploy, make the repo public and enter the Q-Day drill.

## Where the AI was wrong, and how it was caught

Recorded in full in `docs/AI_LOG.md`. Examples:

- A test bug made two attacks look successful; the chain's own events exposed it.
- A draft of the threat model said the chain refused an attack that the vault actually
  refused; caught by re-reading the runner before committing.
- The first drill mode relied on a relayed signature that the chain refused; found by
  probing the chain, then redesigned.
- An early build loaded 3 MB on first paint; found by checking the build output.
