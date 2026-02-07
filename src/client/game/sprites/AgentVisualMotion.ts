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

const OCCUPATION_MICRO_MOTION: Array<{ tokens: string[]; config: IdleMotionConfig }> = [
  { tokens: ['guard', 'watch'], config: { amplitudePx: 0.14, frequencyHz: 0.9 } },
  { tokens: ['farmer', 'gardener', 'worker'], config: { amplitudePx: 0.22, frequencyHz: 1.2 } },
  { tokens: ['merchant', 'shop', 'vendor', 'cook'], config: { amplitudePx: 0.18, frequencyHz: 1.05 } },
  { tokens: ['librarian', 'teacher', 'scholar'], config: { amplitudePx: 0.1, frequencyHz: 0.82 } },
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
