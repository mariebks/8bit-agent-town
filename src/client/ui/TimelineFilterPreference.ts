export type TimelineFilter = 'all' | 'social' | 'conflict' | 'planning' | 'system';

const TIMELINE_FILTER_STORAGE_KEY = 'agent-town.timeline.filter';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const TIMELINE_FILTERS: TimelineFilter[] = ['all', 'social', 'conflict', 'planning', 'system'];

export function loadTimelineFilter(storage: StorageLike | null): TimelineFilter {
  const raw = storage?.getItem(TIMELINE_FILTER_STORAGE_KEY);
  if (!raw) {
    return 'all';
  }
  return isTimelineFilter(raw) ? raw : 'all';
}

export function storeTimelineFilter(filter: TimelineFilter, storage: StorageLike | null): void {
  storage?.setItem(TIMELINE_FILTER_STORAGE_KEY, filter);
}

function isTimelineFilter(value: string): value is TimelineFilter {
  return TIMELINE_FILTERS.includes(value as TimelineFilter);
}
