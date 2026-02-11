import { describe, expect, test } from 'vitest';
import { nextDirectorZoom } from './DirectorZoom';

describe('DirectorZoom', () => {
  test('preserves manually zoomed-in camera above cinematic target', () => {
    expect(nextDirectorZoom(1.42, 1.02, 0.08)).toBeCloseTo(1.42, 6);
  });

  test('eases toward target when current zoom is near target', () => {
    expect(nextDirectorZoom(1.06, 1.02, 0.1)).toBeCloseTo(1.056, 6);
  });
});
