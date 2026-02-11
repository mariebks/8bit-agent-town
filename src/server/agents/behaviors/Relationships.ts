import { AgentId, RelationshipEdge, RelationshipGraph, RelationshipSummary } from '@shared/Types';

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

  getSummary(agentId: AgentId): RelationshipSummary {
    const edges = [...(this.graph.get(agentId)?.values() ?? [])];
    if (edges.length === 0) {
      return {
        friendCount: 0,
        rivalCount: 0,
        averageWeight: 0,
      };
    }

    const sorted = [...edges].sort((a, b) => b.weight - a.weight);
    const sum = edges.reduce((total, edge) => total + edge.weight, 0);

    return {
      friendCount: edges.filter((edge) => edge.weight >= 60).length,
      rivalCount: edges.filter((edge) => edge.weight <= -60).length,
      averageWeight: Math.round((sum / edges.length) * 100) / 100,
      strongestBondId: sorted[0]?.targetId,
      weakestBondId: sorted[sorted.length - 1]?.targetId,
    };
  }

  getEdges(agentId: AgentId): RelationshipEdge[] {
    const edges = this.graph.get(agentId);
    if (!edges) {
      return [];
    }

    return [...edges.values()].sort((left, right) => right.weight - left.weight);
  }

  applyConversationDelta(sourceId: AgentId, targetId: AgentId, delta: number, gameTime: number): RelationshipShift[] {
    const sourceEdge = this.ensureEdge(sourceId, targetId, gameTime);
    const targetEdge = this.ensureEdge(targetId, sourceId, gameTime);
    const beforeSource = classifyRelationshipStance(sourceEdge.weight);
    const beforeTarget = classifyRelationshipStance(targetEdge.weight);
    const beforeSourceWeight = sourceEdge.weight;
    const beforeTargetWeight = targetEdge.weight;

    sourceEdge.weight = clampWeight(sourceEdge.weight + delta);
    targetEdge.weight = clampWeight(targetEdge.weight + Math.round(delta * 0.8));

    sourceEdge.lastInteraction = gameTime;
    targetEdge.lastInteraction = gameTime;

    this.refreshTags(sourceEdge);
    this.refreshTags(targetEdge);

    const shifts: RelationshipShift[] = [];
    const afterSource = classifyRelationshipStance(sourceEdge.weight);
    if (beforeSource !== afterSource) {
      shifts.push({
        sourceId,
        targetId,
        fromWeight: beforeSourceWeight,
        toWeight: sourceEdge.weight,
        stance: afterSource,
      });
    }

    const afterTarget = classifyRelationshipStance(targetEdge.weight);
    if (beforeTarget !== afterTarget) {
      shifts.push({
        sourceId: targetId,
        targetId: sourceId,
        fromWeight: beforeTargetWeight,
        toWeight: targetEdge.weight,
        stance: afterTarget,
      });
    }

    return shifts;
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

export interface RelationshipShift {
  sourceId: AgentId;
  targetId: AgentId;
  fromWeight: number;
  toWeight: number;
  stance: 'friend' | 'rival' | 'acquaintance';
}

function classifyRelationshipStance(weight: number): RelationshipShift['stance'] {
  if (weight >= 60) {
    return 'friend';
  }
  if (weight <= -60) {
    return 'rival';
  }
  return 'acquaintance';
}
