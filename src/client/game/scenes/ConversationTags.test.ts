import { describe, expect, test } from 'vitest';
import { inferConversationTags } from './ConversationTags';

describe('ConversationTags', () => {
  test('infers gossip and planning tags from conversation text', () => {
    const tags = inferConversationTags('I heard around town we should adjust our plan before the market opens.');
    expect(tags).toContain('gossip');
    expect(tags).toContain('plan');
  });

  test('falls back to chat tag when no specific cues exist', () => {
    expect(inferConversationTags('Nice weather today.')).toEqual(['chat']);
  });
});
