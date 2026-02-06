import { AgentId, RelationshipEdge, RelationshipGraph } from '@shared/Types';

const MIN_WEIGHT = -100;
const MAX_WEIGHT = 100;

function clampWeight(value: number): number {
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, Math.round(value)));
}

export class RelationshipManager {
  private readonly graph = new Map<AgentId, Map<AgentId, RelationshipEdge>>();

  initialize(agentIds: AgentId[], initialGameTime: number): void {
    for (const agentId of agentIds) {
      if (!this.graph.has(agentId)) {
        this.graph.set(agentId, new Map());
      }
    }

    for (const sourceId of agentIds) {
      for (const targetId of agentIds) {
        if (sourceId === targetId) {
          continue;
        }

        this.ensureEdge(sourceId, targetId, initialGameTime);
      }
    }
  }

  getWeight(sourceId: AgentId, targetId: AgentId): number {
    return this.ensureEdge(sourceId, targetId, 0).weight;
  }

  applyConversationDelta(sourceId: AgentId, targetId: AgentId, delta: number, gameTime: number): void {
    const sourceEdge = this.ensureEdge(sourceId, targetId, gameTime);
    const targetEdge = this.ensureEdge(targetId, sourceId, gameTime);

    sourceEdge.weight = clampWeight(sourceEdge.weight + delta);
    targetEdge.weight = clampWeight(targetEdge.weight + Math.round(delta * 0.8));

    sourceEdge.lastInteraction = gameTime;
    targetEdge.lastInteraction = gameTime;

    this.refreshTags(sourceEdge);
    this.refreshTags(targetEdge);
  }

  toSerializable(): RelationshipGraph {
    const output: RelationshipGraph = {};

    for (const [agentId, edges] of this.graph) {
      output[agentId] = [...edges.values()];
    }

    return output;
  }

  private ensureEdge(sourceId: AgentId, targetId: AgentId, gameTime: number): RelationshipEdge {
    let sourceEdges = this.graph.get(sourceId);
    if (!sourceEdges) {
      sourceEdges = new Map();
      this.graph.set(sourceId, sourceEdges);
    }

    let edge = sourceEdges.get(targetId);
    if (!edge) {
      edge = {
        targetId,
        weight: 0,
        tags: ['acquaintance'],
        lastInteraction: gameTime,
      };
      sourceEdges.set(targetId, edge);
    }

    return edge;
  }

  private refreshTags(edge: RelationshipEdge): void {
    if (edge.weight >= 60) {
      edge.tags = ['friend'];
      return;
    }

    if (edge.weight <= -60) {
      edge.tags = ['rival'];
      return;
    }

    edge.tags = ['acquaintance'];
  }
}
