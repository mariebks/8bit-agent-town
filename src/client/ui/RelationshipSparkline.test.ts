import { describe, expect, test } from 'vitest';
import { appendRelationshipSample, renderRelationshipSparkline } from './RelationshipSparkline';

describe('RelationshipSparkline', () => {
  test('bounds samples and keeps trailing values', () => {
    const samples = [10, 20, 30];
    const bounded = appendRelationshipSample(samples, 250, 3);
    expect(bounded).toEqual([20, 30, 100]);
  });

  test('renders n/a when there are no samples', () => {
    expect(renderRelationshipSparkline([])).toBe('n/a');
  });

  test('renders denser blocks for stronger positive values', () => {
    const low = renderRelationshipSparkline([-80, -80, -80], 3);
    const high = renderRelationshipSparkline([80, 80, 80], 3);
    expect(low).not.toEqual(high);
  });
});
