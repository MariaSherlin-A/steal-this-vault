/**
 * The earlier draft film's narration, one entry per scene. Each entry is voiced into
 * public/audio/scene-NN (NN = the scene's place in timing.json) and shown as subtitles.
 * The submitted film's narration is in src/film/script.ts.
 */
import type { SceneId } from "./timing";

export const NARRATION: Record<SceneId, string> = {
  wallet: "On a blockchain, your wallet is a single private key. Whoever holds that key owns everything inside it.",
  leak: "And keys leak every day. A phishing email. Malware on a laptop. A seed phrase in the wrong folder. One bad click, and your key belongs to someone else.",
  drain: "Once it leaks, there is no undo. The thief signs, the chain obeys, and the money is gone in seconds.",
  quantum:
    "Soon, they won't even need to steal it. A large enough quantum computer can work out a private key from the public key a wallet reveals when it sends money.",
  qday: "That moment has a name: Q-Day. Every exposed wallet, at once. And keys recorded today can be cracked later.",
  title: "So we built a vault that survives a stolen key. Steal This Vault.",
  dare: "Step one: the dare. We published the owner's private key. The real one, in full. It guards real money on the QoreChain testnet, and anyone can take it.",
  locks:
    "Step two: two locks. The ordinary key every wallet uses, and a quantum-safe key, ML-DSA-87, that never leaves the owner. The chain itself checks both. One key alone moves nothing.",
  attacks:
    "Step three: attack it. Our lab runs eighteen real attacks with the stolen key. Send the coins. Swap the second lock. Fake a signature. Replay the owner's own withdrawal. Seventeen are refused, and every refusal is counted on chain.",
  control:
    "Step four: the control. The eighteenth attack hits an identical vault with only one lock. Same key, same code. That vault is robbed. Ours keeps every coin.",
  product:
    "And it's all live. The site reads the chain as you watch, replays every real attempt, and profiles each attacker, following the stolen money. If the key is ever used, the owner can be alerted, and one command moves the funds out.",
  drill:
    "On Q-Day drill day, the published key was in an attacker's hands from start to finish. Not a single coin left the vault. Our proof transaction, signed with both keys, went straight through.",
  close: "The private key is public. The money is still in the vault. Steal This Vault. Come and try to rob it.",
};
