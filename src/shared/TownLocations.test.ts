import { describe, expect, test } from 'vitest';
import { DEFAULT_TOWN_LOCATIONS, HIGHLIGHTED_LANDMARK_IDS } from './TownLocations';

describe('TownLocations', () => {
  test('has unique location ids', () => {
    const ids = DEFAULT_TOWN_LOCATIONS.map((location) => location.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('highlighted landmarks exist in default set', () => {
    const ids = new Set(DEFAULT_TOWN_LOCATIONS.map((location) => location.id));
    for (const landmarkId of HIGHLIGHTED_LANDMARK_IDS) {
      expect(ids.has(landmarkId)).toBe(true);
    }
  });
});
