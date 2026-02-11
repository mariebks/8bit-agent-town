export interface IdleMotionConfig {
  amplitudePx: number;
  frequencyHz: number;
}

export interface SelectionRingStyle {
  strokeWidth: number;
  strokeAlpha: number;
  fillAlpha: number;
  haloAlpha: number;
}

export interface ShadowStyle {
  width: number;
  height: number;
  alpha: number;
}

const OCCUPATION_MICRO_MOTION: Array<{ tokens: string[]; config: IdleMotionConfig }> = [
  { tokens: ['guard', 'watch'], config: { amplitudePx: 0.14, frequencyHz: 0.9 } },
  { tokens: ['farmer', 'gardener', 'worker'], config: { amplitudePx: 0.22, frequencyHz: 1.2 } },
  { tokens: ['barista', 'baker', 'cook', 'chef'], config: { amplitudePx: 0.2, frequencyHz: 1.15 } },
  { tokens: ['merchant', 'shop', 'vendor', 'cook'], config: { amplitudePx: 0.18, frequencyHz: 1.05 } },
  { tokens: ['clerk', 'administrator', 'town hall'], config: { amplitudePx: 0.11, frequencyHz: 0.84 } },
  { tokens: ['librarian', 'teacher', 'scholar'], config: { amplitudePx: 0.1, frequencyHz: 0.82 } },
  { tokens: ['student', 'apprentice'], config: { amplitudePx: 0.24, frequencyHz: 1.3 } },
  { tokens: ['retired', 'elder'], config: { amplitudePx: 0.08, frequencyHz: 0.72 } },
  { tokens: ['trainer', 'coach', 'instructor'], config: { amplitudePx: 0.24, frequencyHz: 1.25 } },
  { tokens: ['artist', 'bard', 'musician'], config: { amplitudePx: 0.26, frequencyHz: 1.4 } },
];

const DEFAULT_IDLE_CONFIG: IdleMotionConfig = {
  amplitudePx: 0.16,
  frequencyHz: 1,
};

export function idleMotionConfigForOccupation(occupation?: string): IdleMotionConfig {
  const normalized = occupation?.toLowerCase() ?? '';
  for (const variant of OCCUPATION_MICRO_MOTION) {
    if (variant.tokens.some((token) => normalized.includes(token))) {
      return variant.config;
    }
  }
  return DEFAULT_IDLE_CONFIG;
}

export function selectionRingStyleForZoom(zoom: number, selected: boolean): SelectionRingStyle {
  const normalizedZoom = Number.isFinite(zoom) ? Math.max(0.7, Math.min(1.8, zoom)) : 1;
  const zoomBias = normalizedZoom < 1 ? 1 - normalizedZoom : 0;
  const strokeWidth = selected ? (zoomBias > 0.15 ? 2 : 1.4) : 1;
  const strokeAlpha = selected ? Math.min(1, 0.86 + zoomBias * 0.6) : 0.9;
  const fillAlpha = selected ? Math.min(0.3, 0.16 + zoomBias * 0.2) : 0.12;
  const haloAlpha = selected ? Math.min(0.28, 0.12 + zoomBias * 0.22) : 0;
  return {
    strokeWidth,
    strokeAlpha,
    fillAlpha,
    haloAlpha,
  };
}

export function shadowStyleForZoom(zoom: number, selected: boolean): ShadowStyle {
  const normalizedZoom = Number.isFinite(zoom) ? Math.max(0.7, Math.min(1.8, zoom)) : 1;
  const zoomBias = normalizedZoom < 1 ? 1 - normalizedZoom : 0;
  const width = (selected ? 11.2 : 10) + zoomBias * (selected ? 4.4 : 3.6);
  const height = (selected ? 4.8 : 4) + zoomBias * (selected ? 1.8 : 1.2);
  const alphaBase = selected ? 0.3 : 0.24;
  const alpha = Math.min(selected ? 0.44 : 0.34, alphaBase + zoomBias * 0.14);

  return {
    width,
    height,
    alpha,
  };
}
