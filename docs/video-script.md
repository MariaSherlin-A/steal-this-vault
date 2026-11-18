# Demo video: the film

A music-only film, about 2 min 36 s (limit: 3 min, the fest's only video rule). It tells the
problem first, in pictures and big words, then shows how Steal This Vault answers it. There is
no narrator and there are no subtitles: the on-screen words carry the story, and an original
score, composed in code, carries the mood.

Colours are the site's: midnight navy, electric blue, ice cyan, signal red.

## Build it

```sh
cd video
npm install          # once
npm run score        # compose the music to the scene lengths -> public/music/score.wav
npm run render       # -> out/steal-this-vault-demo.mp4
```

Before a final render, re-read the figures from the chain (`npm run status` at the repo root)
and update `video/src/data.json`. Scene lengths live in `video/src/timing.json`; after changing
them, run `npm run score` again so the music still lands on the cuts.

## The score

Synthesised in [video/scripts/score.mjs](../video/scripts/score.mjs), so the film carries no
third-party music. Act one is in a minor key: a sub drone, a heartbeat that quickens, ticking
while the quantum computer works, a riser and a deep impact on Q-Day. At the title it turns to
a major key: a steady 100 BPM pulse with arpeggios that build through the attacks, a tense drop
for drill day, and a resolving chord on the close.

## Scenes

**Act one: the problem**

1. **The wallet** (9 s). "On a blockchain, a wallet is one key." A key wired to a wallet
   holding $48,210.55. Then, in red: "Whoever holds the key owns it all."
2. **The leak** (13 s). "Keys leak every day." A phishing email, malware copying a key, a seed
   phrase in a cloud folder, each turning red. Their lines converge on one key: "One bad click,
   and the key is someone else's."
3. **The drain** (9 s). Marked as a dramatization. "ONE LEAKED KEY." The wallet drains to
   $0.00, a red flash: "THE MONEY IS GONE."
4. **Quantum** (15 s). "Soon, nobody will even need to steal it." A public key flows into a
   quantum computer and a private key comes out, character by character: "It works out the
   private key from the public one."
5. **Q-Day** (9 s). A grid of wallets turns red in a wave. "Q-DAY. Every exposed wallet. At
   once. And public keys recorded today can be cracked later."

**Act two: the answer**

6. **Title** (7 s). "So we built a vault that survives it." The two-ring logo draws itself:
   Steal This Vault. "The private key is public. The money stays."
7. **Step 01, the dare** (12 s). The real published key types in, stamped PUBLISHED ON
   PURPOSE. "The real key. In full. Anyone can take it." The vault balance and live blocks.
8. **Step 02, two locks** (14 s). The ordinary key and the quantum-safe key (ML-DSA-87), checked
   by the chain itself. Both: "the vault pays". The stolen one alone: "refused".
9. **Step 03, attack it** (16 s). The 17 real attacks from the lab, each stamped REFUSED, the
   counter at 17 / 17. The 18th, the control, ROBBED.
10. **Step 04, the control** (12 s). The same key at both vaults: the one-lock vault is
    robbed, the two-lock vault holds, with the real figures.
11. **The product** (18 s). The real website in a browser frame: overview, replay, attacker
    profiles, attack lab, each with a callout. Then the alert and the rescue.
12. **Drill day** (12 s). 18 Nov 2026. A 24-hour ring fills, "Coins the attacker moved: 0",
    and the real proof transaction, signed with both keys.
13. **Close** (10 s). Four real numbers, the logo, "The private key is public. The money is
    still in the vault.", the site address and the fest.

## Optional voiceover

The film does not need one. If a voiceover is ever added, `video/src/script.ts` holds a
narration draft, and `npm run timing` fits scene lengths to recordings in `video/public/audio`.
