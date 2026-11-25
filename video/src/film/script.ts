/**
 * The narration of the second film, as approved by Maria.
 * One line per scene. scripts/voice-film.py voices these and records word timings.
 */
export const SCENES = ["problem", "qday", "dare", "locks", "replay", "score", "lab", "drill", "watch", "intruders", "close"] as const;
export type FilmScene = (typeof SCENES)[number];

export const LINES: Record<FilmScene, string> = {
  problem:
    "Almost every crypto wallet is guarded by one thing: a private key. A fake website asks for it. Malware copies it. A backup ends up on a sticky note. Whoever holds the key owns the money, and a blockchain can't undo a theft. Last year alone, more than three billion dollars was stolen.",
  qday:
    "And there's a bigger threat coming. One day, quantum computers will work out private keys from data that is already public. That day has a name: Q-Day. On Q-Day, every ordinary key is as good as stolen, all at once.",
  dare:
    "So we skipped the wait. Steal This Vault publishes the real private key of a crypto vault. Copy it. Use it. The money is still inside: about ten QOR, read live from the chain.",
  locks:
    "Because here, one key was never enough. The stolen key opens the first lock. The second lock needs a quantum-safe signature from a key that never leaves the owner. The chain checks it, and then the vault checks it again. No second signature, no money.",
  replay:
    "These aren't animations of what might happen. They are real break-in attempts, replayed from the record the vault keeps on the chain. Every one hits the same wall.",
  score:
    "To prove the second lock is what matters, we built a twin: the same vault with only the ordinary lock, like almost every wallet today. Same key. The twin was robbed. And the vault keeps its own count of what one lock would have lost: nearly forty QOR. It lost nothing.",
  lab:
    "And you don't have to trust us. Anyone can open the attack lab and try eighteen real ways to use a stolen key, live. Eighteen out of eighteen: refused. Zero lost. Run the same robbery on the twin, and it pays.",
  drill:
    "On the eighteenth of November, the fest staged Q-Day for real. A bot held our key for twenty-four hours and tried everything. Zero thefts. Zero lost. And the owner, holding both keys, still got in.",
  watch:
    "When someone tries, the owner is told straight away, while the money is still there. And if it ever comes to it, there's a way out: shut the side door and move everything to a fresh account. Only the owner can.",
  intruders: "And every thief leaves a trail: who tried, what they got, and where the money went next.",
  close:
    "Keys will leak. Q-Day will come. The answer is a second, quantum-safe lock, built so any app can use it. Steal This Vault. The key is free. The money isn't.",
};
