export function normalizeHighlightedIndex(current: number, resultCount: number): number {
  if (resultCount <= 0) {
    return -1;
  }
  if (current < 0) {
    return -1;
  }
  return Math.min(current, resultCount - 1);
}

export function nextHighlightedIndex(current: number, resultCount: number, direction: 'up' | 'down'): number {
  if (resultCount <= 0) {
    return -1;
  }

  if (current < 0) {
    return direction === 'down' ? 0 : resultCount - 1;
  }

  const normalized = normalizeHighlightedIndex(current, resultCount);
  if (direction === 'down') {
    return (normalized + 1) % resultCount;
  }
  return (normalized - 1 + resultCount) % resultCount;
}
