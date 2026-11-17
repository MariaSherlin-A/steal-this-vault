# Demo video script

An animated film, not a screen recording: dark, slow, cinematic, in the site's own colours
(warm black, brass, mint, red). Your voice carries it. The pictures are built from code in
[video/](../video/) and rendered to MP4 with your audio placed scene by scene.

Length: about 2 min 40 s at a calm reading pace. Limit: 3 min. Eight scenes, 380 words.

## Recording your voice

- One audio file per scene, named `scene-01.mp3` to `scene-08.mp3` (WAV or M4A also fine).
  Put them in `video/public/audio/`. One file per scene lets the pictures follow your pace.
- Read slowly. Pause at full stops. Leave about half a second of silence at the start and
  end of each file. Do not rush the last line of a scene; it is the one people remember.
- Quiet room, phone 15 cm from your mouth, or a headset. A phone voice memo is good enough.
- If you stumble, stop and record that scene again from the start. Don't splice.
- Say the words as written. The on-screen text matches them.

## Scenes

### Scene 1. The key (about 10 s)

Picture: black. Hex characters drift like rain. One line is typed out, then the real
published private key appears, glowing brass, alone on the screen.

> This is a private key. It controls a vault with real coins in it.
> And it is public. We put it there.

### Scene 2. Q-Day (about 22 s)

Picture: a field of small keys, warm and dim. A lock icon cracks. The keys turn red in a
wave, left to right. The words Q-DAY in serif, large.

> Every wallet on every chain today is locked with a key like this one.
> The day a quantum computer arrives, those keys stop being secret.
> Security people call it Q-Day.
> On that day, a stolen key is not a bug. It is every key.

### Scene 3. Two vaults (about 24 s)

Picture: two vault doors drawn in brass line. The left one has one lock. The right one has
two; the second lock glows mint and the label ML-DSA-87 appears under it. Then the key from
scene 1 drops in between them.

> So we built two vaults on the QoreChain testnet, with the same owner and the same leaked key.
> The one-lock vault checks only the classical signature.
> The two-lock vault also demands a post-quantum signature, ML-DSA-87,
> checked on chain against the key the chain itself holds for the owner.
> And then we handed out the key.

### Scene 4. Eighteen ways to steal (about 42 s)

Picture: an attack feed. Eighteen attempts type in one after another; each gets a red
REFUSED stamp slammed over it with the reason the vault gave. The two-lock door shakes and
holds every time. On the last row the one-lock door swings open, coins fly out, and the
stamp is ROBBED in brass. Counter at the bottom: 17 refused, 1 robbed.

> Eighteen ways to steal.
> Send the coins. Add a second key of your own. Swap the owner's lock for yours.
> Open the side door. Hand the vault a fake signature.
> Replay the owner's last real withdrawal. Reuse a real signature on a new request.
> Every attempt is written on chain by the vault itself, with the reason it was refused.
> Seventeen refused.
> And the one-lock vault, the control, the kind of vault the rest of the world still uses:
> robbed. Same thief. Same key.
> One lock gave way. Two locks held.

### Scene 5. The record (about 18 s)

Picture: a chain of blocks slides past. A panel shows the real numbers read from the chain
on the day of rendering, labelled with the date: what the two-lock vault holds, what it
would have lost, how many attempts it refused, how many times the one-lock vault paid out.

> The record is public. The vault counts every attempt, and what it would have lost.
> Anyone can run the attacks, from the site or from the command line,
> and check every one of them on the explorer.

### Scene 6. How it holds (about 26 s)

Picture: three rings around a coin. Each ring lights as it is named: the chain, the window,
the vault. The outer rings are brass; the inner one is mint.

> Three layers.
> The chain refuses any native transaction that lacks the second signature.
> The chain's window lets the owner's account reach only the two vaults,
> and only the owner can open it, with both keys.
> And the vault itself verifies the post-quantum signature with the chain's precompile.
> There is no fallback. If a check fails, the vault counts the attempt and keeps the money.

### Scene 7. Still alive (about 22 s)

Picture: one row in the feed gets a mint PAID stamp: "Paid out to the owner, who signed
with both keys." Then four small cards fade in: keeper, drill mode, tests, two audits.

> A vault that refuses everyone is just a hole.
> This one pays its owner, who signs with both keys.
> A keeper renews the window and proves the vault is alive.
> A drill mode empties the control vault and shuts the door for the fest's Q-Day drill.
> The contracts are tested against a real ML-DSA-87 implementation, and audited twice.

### Scene 8. Close (about 12 s)

Picture: the key again, then the tagline typed in serif, then the address of the site and
the repository.

> The key is on the screen. The money is still in the vault.
> Steal This Vault.
> The key is free. The money isn't.

## After recording

Put the eight files in `video/public/audio/`, then from the repository root:

```sh
npm run video:timing   # measures each file and sets the scene lengths
npm run video          # renders video/out/steal-this-vault-demo.mp4
```

Upload the MP4 to YouTube as unlisted and paste the link in the fest form.
