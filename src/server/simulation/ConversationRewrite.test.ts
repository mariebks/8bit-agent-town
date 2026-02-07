import { describe, expect, test } from 'vitest';
import {
  lineSimilarity,
  pickRewriteCandidate,
  rewriteFallbackCandidates,
  shouldRewriteCandidate,
} from './ConversationRewrite';

describe('ConversationRewrite', () => {
  test('flags weak and repetitive candidates for rewrite', () => {
    expect(shouldRewriteCandidate('Too short', 'market prices', [])).toBe(true);
    expect(
      shouldRewriteCandidate('Market prices still matter and we should compare stalls.', 'market prices', [
        'Market prices still matter and we should compare stalls.',
      ]),
    ).toBe(true);
    expect(shouldRewriteCandidate('Market prices still matter and we should compare stalls by district.', 'market prices', [])).toBe(
      false,
    );
  });

  test('builds varied fallback candidates with topic references', () => {
    const candidates = rewriteFallbackCandidates({
      topic: 'market prices',
      intent: 'coordinate',
      turnGoal: 'agree on next step for market prices',
    });

    expect(candidates).toHaveLength(8);
    expect(candidates.every((line) => line.toLowerCase().includes('market prices'))).toBe(true);
  });

  test('picks the first non-similar fallback candidate from a seeded start index', () => {
    const candidates = [
      'Let us revisit market prices after we gather one more concrete detail.',
      'I do not want to loop on market prices; we can try one small experiment first.',
      'Short version on market prices: we align now, then verify in the next round.',
    ];

    const picked = pickRewriteCandidate(candidates, [candidates[0]], 0);
    expect(picked).toBe(candidates[1]);
  });

  test('computes token-overlap line similarity', () => {
    expect(lineSimilarity('market prices today', 'market prices tomorrow')).toBeGreaterThan(0.3);
    expect(lineSimilarity('market prices today', 'weather at dusk')).toBeLessThan(0.2);
  });
});
