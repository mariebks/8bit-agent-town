import { DigestItem } from './StoryDigest';

export function areDigestItemsEqual(left: DigestItem[], right: DigestItem[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (
      a.id !== b.id ||
      a.headline !== b.headline ||
      a.tickId !== b.tickId ||
      a.kind !== b.kind ||
      a.agentId !== b.agentId
    ) {
      return false;
    }
  }
  return true;
}
