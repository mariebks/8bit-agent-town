import { AgentData, RelationshipEdge } from '@shared/Types';

export interface RelationshipHeatRow {
  targetId: string;
  targetName: string;
  weight: number;
  stance: 'friend' | 'rival' | 'neutral';
  intensity: number;
}

export function buildRelationshipHeatRows(selected: AgentData, agents: AgentData[]): RelationshipHeatRow[] {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const edges = [...(selected.relationshipEdges ?? [])];

  return edges
    .map((edge) => toRow(edge, byId.get(edge.targetId)?.name))
    .sort((left, right) => {
      if (Math.abs(right.weight) !== Math.abs(left.weight)) {
        return Math.abs(right.weight) - Math.abs(left.weight);
      }
      return right.weight - left.weight;
    });
}

function toRow(edge: RelationshipEdge, targetName?: string): RelationshipHeatRow {
  const stance: RelationshipHeatRow['stance'] =
    edge.weight >= 60 ? 'friend' : edge.weight <= -60 ? 'rival' : 'neutral';
  const intensity = Math.min(1, Math.abs(edge.weight) / 100);

  return {
    targetId: edge.targetId,
    targetName: targetName ?? edge.targetId,
    weight: edge.weight,
    stance,
    intensity,
  };
}
