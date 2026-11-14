/**
 * Protobuf encoding of `cosmos.bank.v1beta1.MsgSend`, the one message the page
 * asks QoreX to sign. Written out by hand (it is three length-prefixed fields)
 * so the first paint does not need a protobuf library; the unit test checks it
 * byte for byte against the SDK's own encoder.
 *
 *   MsgSend { string from_address = 1; string to_address = 2; repeated Coin amount = 3; }
 *   Coin    { string denom = 1; string amount = 2; }
 */
export const MSG_SEND_TYPE_URL = "/cosmos.bank.v1beta1.MsgSend";

const utf8 = new TextEncoder();

function varint(n: number): number[] {
  const out: number[] = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
  return out;
}

/** One length-delimited field: tag byte, length, bytes. Field numbers here are all below 16. */
function field(number: number, bytes: Uint8Array | number[]): number[] {
  return [(number << 3) | 2, ...varint(bytes.length), ...bytes];
}

export function encodeMsgSend(from: string, to: string, uqor: bigint): Uint8Array {
  if (uqor <= 0n) throw new Error("amount must be positive");
  const coin = [...field(1, utf8.encode("uqor")), ...field(2, utf8.encode(uqor.toString()))];
  return Uint8Array.from([...field(1, utf8.encode(from)), ...field(2, utf8.encode(to)), ...field(3, coin)]);
}
