import { HighlightsReelSnapshot } from './HighlightsReel';

export function areHighlightsSnapshotsEqual(left: HighlightsReelSnapshot | null, right: HighlightsReelSnapshot): boolean {
  if (!left) {
    return false;
  }
  if (
    left.summary !== right.summary ||
    left.topAgentId !== right.topAgentId ||
    left.topAgentName !== right.topAgentName ||
    left.eventCount !== right.eventCount ||
    left.bullets.length !== right.bullets.length
  ) {
    return false;
  }

  for (let index = 0; index < left.bullets.length; index += 1) {
    if (left.bullets[index] !== right.bullets[index]) {
      return false;
    }
  }
  return true;
}
