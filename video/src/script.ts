/**
 * The narration, one entry per scene. The same words are recorded into
 * public/audio/scene-NN and shown as captions, so keep them identical to
 * docs/video-script.md.
 */
import type { SceneId } from "./timing";

/** Optional: the film is music-only, so these are used only if a voiceover is ever added. */
export const NARRATION: Partial<Record<SceneId, string>> = {
  drain:
    "One leaked private key. That's all it takes. On almost every blockchain, whoever holds the key owns the wallet, and the money is gone in seconds.",
  quantum:
    "Today, keys leak through phishing and malware. Tomorrow, quantum computers will work them out from public data. That day has a name: Q-Day. Every exposed wallet becomes a leaked key.",
  title: "So we built a vault that survives it. Steal This Vault.",
  dare: "Step one: the dare. We published the owner's private key. The real one, in full, on the website. It guards real money on the QoreChain testnet, and anyone can take it.",
  locks:
    "Step two: two locks. The ordinary key every wallet uses, and a quantum-safe key, ML-DSA-87, that never leaves the owner. The chain itself checks both signatures. One without the other moves nothing.",
  attacks:
    "Step three: attack it. The lab runs eighteen real attacks with the stolen key. Send the coins. Swap the second lock. Fake a signature. Replay the owner's own withdrawal. Seventeen are refused, and the vault counts every refusal on chain.",
  control:
    "Step four: the control. The eighteenth attack hits an identical vault with only the ordinary lock. Same key, same code. That one gets robbed. The two-lock vault keeps every coin.",
  product:
    "And it's all live. The site reads the chain as you watch. The replay plays back every real attempt. The threat log profiles each attacker and follows the stolen money. If the key is ever used, the owner is alerted, and one command moves the funds out.",
  drill:
    "On Q-Day drill day, the published key was in an attacker's hands from start to finish. Not a single coin left the vault. Our proof transaction, signed with both keys, went straight through.",
  close: "The private key is public. The money is still in the vault. Steal This Vault. Come and try.",
};
