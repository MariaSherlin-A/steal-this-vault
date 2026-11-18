# Demo video: the film

A narrated film of about 2 min 20 s (limit: 3 min, the fest's only video rule). Act one tells
the problem in pictures and big words; act two shows how Steal This Vault answers it. A
narrator voices every scene, subtitles follow the voice, and an original score, composed in
code, dips under the narration. Colours are the site's: midnight navy, electric blue, ice
cyan, signal red.

## Build it

```sh
cd video
npm install          # once
# put the voice files in public/audio: scene-01.mp3 ... scene-13.mp3 (wav/m4a also fine)
npm run timing       # fit each scene to its recording, time the subtitles to the pauses
npm run score        # compose the music to the new scene lengths
npm run render       # -> out/steal-this-vault-demo.mp4
```

Before a final render, re-read the figures from the chain (`npm run status` at the repo root)
and update `video/src/data.json`.

## How the sync works

Each scene lasts exactly as long as its recording plus 0.6 s, so a cut never lands mid-sentence.
`scripts/timing.mjs` finds the pauses in each recording with ffmpeg and starts each subtitle
where the voice resumes. The music is composed to the resulting lengths and drops to about a
third of its volume while the narrator speaks.

## Narration, scene by scene

Generate or record one file per scene, with the exact words below (the subtitles use them).

### scene-01: The wallet

> On a blockchain, your wallet is a single private key. Whoever holds that key owns everything inside it.

### scene-02: The leak

> And keys leak every day. A phishing email. Malware on a laptop. A seed phrase in the wrong folder. One bad click, and your key belongs to someone else.

### scene-03: The drain

> Once it leaks, there is no undo. The thief signs, the chain obeys, and the money is gone in seconds.

### scene-04: Quantum

> Soon, they won't even need to steal it. A large enough quantum computer can work out a private key from the public key a wallet reveals when it sends money.

### scene-05: Q-Day

> That moment has a name: Q-Day. Every exposed wallet, at once. And keys recorded today can be cracked later.

### scene-06: Title

> So we built a vault that survives a stolen key. Steal This Vault.

### scene-07: Step 01, the dare

> Step one: the dare. We published the owner's private key. The real one, in full. It guards real money on the QoreChain testnet, and anyone can take it.

### scene-08: Step 02, two locks

> Step two: two locks. The ordinary key every wallet uses, and a quantum-safe key, ML-DSA-87, that never leaves the owner. The chain itself checks both. One key alone moves nothing.

### scene-09: Step 03, attack it

> Step three: attack it. Our lab runs eighteen real attacks with the stolen key. Send the coins. Swap the second lock. Fake a signature. Replay the owner's own withdrawal. Seventeen are refused, and every refusal is counted on chain.

### scene-10: Step 04, the control

> Step four: the control. The eighteenth attack hits an identical vault with only one lock. Same key, same code. That vault is robbed. Ours keeps every coin.

### scene-11: The product

> And it's all live. The site reads the chain as you watch, replays every real attempt, and profiles each attacker, following the stolen money. If the key is ever used, the owner can be alerted, and one command moves the funds out.

### scene-12: Drill day

> On Q-Day drill day, the published key was in an attacker's hands from start to finish. Not a single coin left the vault. Our proof transaction, signed with both keys, went straight through.

### scene-13: Close

> The private key is public. The money is still in the vault. Steal This Vault. Come and try to rob it.

## The score

Synthesised in [video/scripts/score.mjs](../video/scripts/score.mjs), so the film carries no
third-party music: a dark drone, a quickening heartbeat and a riser into a deep impact on Q-Day,
then a major-key pulse with arpeggios through the answer, and a resolving chord on the close.
