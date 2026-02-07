import { AgentState } from '@shared/Types';
import { describe, expect, test } from 'vitest';
import { searchAgents } from './AgentFinder';

function agent(id: string, name: string, occupation?: string) {
  return {
    id,
    name,
    occupation,
    position: { x: 0, y: 0 },
    tilePosition: { tileX: 0, tileY: 0 },
    state: AgentState.Idle,
    color: 0xffffff,
  };
}

describe('AgentFinder', () => {
  test('returns strongest name-prefix matches first', () => {
    const hits = searchAgents('al', [agent('a1', 'Alex'), agent('a2', 'Blair'), agent('a3', 'Alina')], 5);
    expect(hits.map((hit) => hit.name)).toEqual(['Alex', 'Alina']);
  });

  test('matches occupation tokens when name does not match', () => {
    const hits = searchAgents('guard', [agent('a1', 'Ari', 'Town Guard'), agent('a2', 'Bea', 'Farmer')], 5);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('a1');
  });

  test('returns empty list for empty query', () => {
    expect(searchAgents('   ', [agent('a1', 'Alex')], 5)).toEqual([]);
  });

  test('matches minor typos in names and occupations', () => {
    const hits = searchAgents(
      'gard',
      [agent('a1', 'Ari', 'Town Guard'), agent('a2', 'Bea', 'Gardener'), agent('a3', 'Cora', 'Teacher')],
      5,
    );
    expect(hits.map((hit) => hit.id)).toEqual(['a2', 'a1']);
  });

  test('matches by name initials for multi-word names', () => {
    const hits = searchAgents('aj', [agent('a1', 'Alice June'), agent('a2', 'Ari Stone')], 5);
    expect(hits[0]?.id).toBe('a1');
  });
});
