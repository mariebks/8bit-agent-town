export interface SpeechBubbleLayoutEntry {
  agentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  preferredOffsetY: number;
  selected?: boolean;
}

interface LayoutRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface LayoutOptions {
  minGapPx?: number;
  maxLiftPx?: number;
}

const DEFAULT_MIN_GAP_PX = 8;
const DEFAULT_MAX_LIFT_PX = 56;

export function layoutSpeechBubbleOffsets(
  entries: SpeechBubbleLayoutEntry[],
  options: LayoutOptions = {},
): Map<string, number> {
  const minGapPx = Math.max(2, Math.round(options.minGapPx ?? DEFAULT_MIN_GAP_PX));
  const maxLiftPx = Math.max(minGapPx, Math.round(options.maxLiftPx ?? DEFAULT_MAX_LIFT_PX));
  const ordered = [...entries].sort((a, b) => {
    const selectedWeightA = a.selected ? 1 : 0;
    const selectedWeightB = b.selected ? 1 : 0;
    if (selectedWeightA !== selectedWeightB) {
      return selectedWeightB - selectedWeightA;
    }
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  const placed: LayoutRect[] = [];
  const offsets = new Map<string, number>();

  for (const entry of ordered) {
    let candidateOffset = entry.preferredOffsetY;
    let attempts = 0;

    while (attempts < 16) {
      const rect = layoutRect(entry, candidateOffset);
      const collision = placed.some((placedRect) => intersectsWithPadding(rect, placedRect, minGapPx));
      if (!collision) {
        placed.push(rect);
        offsets.set(entry.agentId, candidateOffset);
        break;
      }

      candidateOffset -= minGapPx;
      if (entry.preferredOffsetY - candidateOffset > maxLiftPx) {
        placed.push(layoutRect(entry, candidateOffset));
        offsets.set(entry.agentId, candidateOffset);
        break;
      }
      attempts += 1;
    }

    if (!offsets.has(entry.agentId)) {
      offsets.set(entry.agentId, candidateOffset);
    }
  }

  return offsets;
}

function layoutRect(entry: SpeechBubbleLayoutEntry, offsetY: number): LayoutRect {
  const centerX = entry.x;
  const centerY = entry.y + offsetY;
  return {
    left: centerX - entry.width / 2,
    right: centerX + entry.width / 2,
    top: centerY - entry.height / 2,
    bottom: centerY + entry.height / 2,
  };
}

function intersectsWithPadding(a: LayoutRect, b: LayoutRect, padding: number): boolean {
  return !(a.right + padding < b.left || a.left > b.right + padding || a.bottom + padding < b.top || a.top > b.bottom + padding);
}
