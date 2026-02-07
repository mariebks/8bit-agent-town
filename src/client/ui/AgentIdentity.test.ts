import { describe, expect, test } from 'vitest';
import { buildAgentIdentityToken, buildRoleBadge } from './AgentIdentity';

describe('AgentIdentity', () => {
  test('builds stable identity tokens from agent metadata', () => {
    const token = buildAgentIdentityToken({
      id: 'agent-1',
      name: 'Alex Harper',
      color: 0x44aa66,
      occupation: 'Library Assistant',
    });

    expect(token.initials).toBe('AH');
    expect(token.roleBadge).toBe('LA');
    expect(token.gradient.startsWith('linear-gradient')).toBe(true);
    expect(token.border.startsWith('#')).toBe(true);
  });

  test('builds role badges for short and missing occupations', () => {
    expect(buildRoleBadge('Merchant')).toBe('Merchant');
    expect(buildRoleBadge(undefined)).toBe('Townsperson');
    expect(buildRoleBadge('   ')).toBe('Townsperson');
  });
});
