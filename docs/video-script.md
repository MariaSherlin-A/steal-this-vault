# Demo video script

A film, not a screen recording. It opens like a short cinematic story, moves into a bold
step-by-step explainer, shows the real website with callouts, and closes on real numbers.
Colours are the site's: midnight navy, electric blue, ice cyan, signal red. The pictures are
built from code in [video/](../video/) and rendered to MP4 with your voice placed scene by
scene. Captions of your words run along the bottom.

Length: about 2 min 15 s at a steady pace. Limit: 3 min. Ten scenes, about 320 words.

## Recording your voice

- One audio file per scene, named `scene-01.mp3` to `scene-10.mp3` (WAV or M4A also fine).
  Put them in `video/public/audio/`. Each scene stretches to fit your recording.
- Read with energy, a little faster than conversation. Pause at full stops. Leave about half
  a second of silence at the start and end of each file.
- Quiet room, phone 15 cm from your mouth, or a headset. A phone voice memo is good enough.
- If you stumble, record that scene again from the start. Don't splice.
- Say the words exactly as written: the captions show the same words.
- Before the final render, the numbers in `video/src/data.json` are re-read from the chain.

## Scenes

### Scene 1. Incident (about 11 s)

Picture: red-tinted network. "ONE LEAKED KEY." glitches in. A wallet card drains from
$48,210.55 to $0.00, a red flash, then "THE MONEY IS GONE." Marked as a dramatization.

> One leaked private key. That's all it takes. On almost every blockchain, whoever holds
> the key owns the wallet, and the money is gone in seconds.

### Scene 2. The threat (about 14 s)

Picture: "Phishing" and "Malware" struck through, then "Quantum computers." in blue. A public
key turns red character by character, a lock splits in two, and Q-DAY slams in.

> Today, keys leak through phishing and malware. Tomorrow, quantum computers will work them
> out from public data. That day has a name: Q-Day. Every exposed wallet becomes a leaked key.

### Scene 3. Title (about 6 s)

Picture: the two-ring logo draws itself. "Steal This Vault", a light sweep, the tagline.

> So we built a vault that survives it. Steal This Vault.

### Scene 4. Step 1, the dare (about 13 s)

Picture: STEP 01 THE DARE. The real published key types in, stamped PUBLISHED ON PURPOSE.
The vault balance counts up. Real testnet blocks tick along the bottom.

> Step one: the dare. We published the owner's private key. The real one, in full, on the
> website. It guards real money on the QoreChain testnet, and anyone can take it.

### Scene 5. Step 2, two locks (about 15 s)

Picture: STEP 02 TWO LOCKS. Lock 1 (ordinary key) and lock 2 (quantum-safe key) wired to the
vault, the chain's checker below. Both signatures arrive: "the vault pays". Then only the
stolen one: lock 2 flashes red, "One key alone: refused."

> Step two: two locks. The ordinary key every wallet uses, and a quantum-safe key, ML-DSA-87,
> that never leaves the owner. The chain itself checks both signatures. One without the other
> moves nothing.

### Scene 6. Step 3, attack it (about 18 s)

Picture: STEP 03 ATTACK IT. The 17 real attacks from the lab stream in, each stamped
REFUSED, the counter climbing to 17 / 17. Then the 18th in red: the control, ROBBED.

> Step three: attack it. The lab runs eighteen real attacks with the stolen key. Send the
> coins. Swap the second lock. Fake a signature. Replay the owner's own withdrawal. Seventeen
> are refused, and the vault counts every refusal on chain.

### Scene 7. Step 4, the control (about 13 s)

Picture: STEP 04 THE CONTROL. The same key flies at two vaults. The one-lock vault bursts
open, coins fly, ROBBED. The two-lock vault pulses a shield, REFUSED, with the real figures.

> Step four: the control. The eighteenth attack hits an identical vault with only the
> ordinary lock. Same key, same code. That one gets robbed. The two-lock vault keeps every coin.

### Scene 8. The product (about 20 s)

Picture: the real website in a browser frame, slowly zooming: the overview, the replay, the
attacker profiles, the attack lab, each with a callout. Then two cards: the alert, the rescue.

> And it's all live. The site reads the chain as you watch. The replay plays back every real
> attempt. The threat log profiles each attacker and follows the stolen money. If the key is
> ever used, the owner is alerted, and one command moves the funds out.

### Scene 9. Drill day (about 13 s)

Picture: "18 NOV 2026 · Q-DAY DRILL" typed out. A 24-hour ring fills. "Coins the attacker
moved: 0". The real proof transaction hash, block and time, signed with both keys.

> On Q-Day drill day, the published key was in an attacker's hands from start to finish.
> Not a single coin left the vault. Our proof transaction, signed with both keys, went
> straight through.

### Scene 10. Close (about 9 s)

Picture: four real numbers count up (still in the vault, attempts refused, saved by the
second lock, attacks in the lab). The logo, the site address, the fest.

> The private key is public. The money is still in the vault. Steal This Vault. Come and try.
