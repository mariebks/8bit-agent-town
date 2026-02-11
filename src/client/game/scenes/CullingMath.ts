export type AgentLod = 'near' | 'far' | 'culled';

export interface CullingConfig {
  nearDistancePx: number;
  farDistancePx: number;
  cullDistancePx: number;
  bubbleCullDistancePx: number;
  farUpdateInterval: number;
  culledUpdateInterval: number;
}

export interface SpeechBubbleVisibilityCandidate {
  agentId: string;
  selected: boolean;
  baseVisible: boolean;
  distanceToCamera: number;
}

export type SpeechBubbleAlphaMode = 'spectator' | 'story' | 'debug';

export const DEFAULT_CULLING_CONFIG: CullingConfig = {
  nearDistancePx: 280,
  farDistancePx: 420,
  cullDistancePx: 560,
  bubbleCullDistancePx: 420,
  farUpdateInterval: 3,
  culledUpdateInterval: 10,
};

export function classifyAgentLod(
  agentX: number,
  agentY: number,
  cameraCenterX: number,
  cameraCenterY: number,
  config: CullingConfig = DEFAULT_CULLING_CONFIG,
): AgentLod {
  const distance = Math.hypot(agentX - cameraCenterX, agentY - cameraCenterY);
  if (distance <= config.nearDistancePx) {
    return 'near';
  }
  if (distance <= config.farDistancePx) {
    return 'far';
  }
  return distance <= config.cullDistancePx ? 'far' : 'culled';
}

export function movementUpdateInterval(
  lod: AgentLod,
  config: CullingConfig = DEFAULT_CULLING_CONFIG,
): number {
  if (lod === 'near') {
    return 1;
  }
  if (lod === 'far') {
    return config.farUpdateInterval;
  }
  return config.culledUpdateInterval;
}

export function shouldRenderBubble(
  agentX: number,
  agentY: number,
  cameraCenterX: number,
  cameraCenterY: number,
  config: CullingConfig = DEFAULT_CULLING_CONFIG,
): boolean {
  const distance = Math.hypot(agentX - cameraCenterX, agentY - cameraCenterY);
  return distance <= config.bubbleCullDistancePx;
}

export function shouldShowSpeechBubble(
  selected: boolean,
  selectedOnly: boolean,
  spriteVisible: boolean,
  withinBubbleRange: boolean,
): boolean {
  if (selected) {
    return true;
  }
  if (selectedOnly) {
    return false;
  }
  return spriteVisible && withinBubbleRange;
}

export function selectVisibleSpeechBubbleAgentIds(
  candidates: readonly SpeechBubbleVisibilityCandidate[],
  maxBackgroundVisible: number,
): Set<string> {
  const visible = new Set<string>();
  const background: SpeechBubbleVisibilityCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.baseVisible) {
      continue;
    }
    if (candidate.selected) {
      visible.add(candidate.agentId);
      continue;
    }
    background.push(candidate);
  }

  if (maxBackgroundVisible <= 0) {
    return visible;
  }

  background.sort((left, right) => {
    if (left.distanceToCamera !== right.distanceToCamera) {
      return left.distanceToCamera - right.distanceToCamera;
    }
    return left.agentId.localeCompare(right.agentId);
  });

  const limit = Math.min(maxBackgroundVisible, background.length);
  for (let index = 0; index < limit; index += 1) {
    visible.add(background[index].agentId);
  }

  return visible;
}

export function computeSpeechBubbleAlpha(
  selected: boolean,
  distanceToCamera: number,
  remainingMs: number,
  durationMs: number,
  mode: SpeechBubbleAlphaMode,
): number {
  if (selected) {
    return 1;
  }

  const modeBase = mode === 'debug' ? 0.97 : mode === 'story' ? 0.92 : 0.86;
  const normalizedDistance = Math.max(0, Math.min(1, distanceToCamera / DEFAULT_CULLING_CONFIG.bubbleCullDistancePx));
  const distanceFactor = 1 - normalizedDistance * 0.45;
  const safeDurationMs = durationMs > 0 ? durationMs : 1;
  const remainingRatio = Math.max(0, Math.min(1, remainingMs / safeDurationMs));
  const lifeProgress = 1 - remainingRatio;
  const ageFactor = 1 - lifeProgress * 0.3;

  return Math.max(0.3, Math.min(1, modeBase * distanceFactor * ageFactor));
}
