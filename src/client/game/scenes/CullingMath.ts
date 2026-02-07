export type AgentLod = 'near' | 'far' | 'culled';

export interface CullingConfig {
  nearDistancePx: number;
  farDistancePx: number;
  cullDistancePx: number;
  bubbleCullDistancePx: number;
  farUpdateInterval: number;
  culledUpdateInterval: number;
}

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
