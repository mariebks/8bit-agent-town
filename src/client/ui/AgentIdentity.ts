import { AgentData } from '@shared/Types';

export interface AgentIdentityToken {
  initials: string;
  roleBadge: string;
  gradient: string;
  border: string;
}

export function buildAgentIdentityToken(agent: Pick<AgentData, 'id' | 'name' | 'color' | 'occupation'>): AgentIdentityToken {
  const name = (agent.name ?? '').trim();
  const initials = buildInitials(name);
  const roleBadge = buildRoleBadge(agent.occupation);
  const base = agent.color & 0xffffff;
  const accent = blend(base, 0xd4f3a8, 0.34);
  const edge = shade(base, 0.62);

  return {
    initials,
    roleBadge,
    gradient: `linear-gradient(135deg, ${toCss(base)} 0%, ${toCss(accent)} 100%)`,
    border: toCss(edge),
  };
}

export function buildRoleBadge(occupation: string | undefined): string {
  if (!occupation || occupation.trim().length === 0) {
    return 'Townsperson';
  }

  const normalized = occupation.trim();
  if (normalized.length <= 16) {
    return normalized;
  }

  const words = normalized.split(/\s+/).filter((word) => word.length > 0);
  if (words.length <= 1) {
    return normalized.slice(0, 16).trim();
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function buildInitials(name: string): string {
  if (!name) {
    return '??';
  }

  const words = name.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  const first = words[0][0] ?? '';
  const second = words[1][0] ?? '';
  return `${first}${second}`.toUpperCase();
}

function blend(left: number, right: number, amount: number): number {
  const clamped = Math.max(0, Math.min(1, amount));
  const lr = (left >> 16) & 0xff;
  const lg = (left >> 8) & 0xff;
  const lb = left & 0xff;
  const rr = (right >> 16) & 0xff;
  const rg = (right >> 8) & 0xff;
  const rb = right & 0xff;
  const red = clamp(lr + (rr - lr) * clamped);
  const green = clamp(lg + (rg - lg) * clamped);
  const blue = clamp(lb + (rb - lb) * clamped);
  return (red << 16) | (green << 8) | blue;
}

function shade(color: number, factor: number): number {
  const red = clamp(((color >> 16) & 0xff) * factor);
  const green = clamp(((color >> 8) & 0xff) * factor);
  const blue = clamp((color & 0xff) * factor);
  return (red << 16) | (green << 8) | blue;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toCss(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}
