import { timingSafeEqual } from "node:crypto";

const encoder = new TextEncoder();

export function timingSafeStringEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
}
