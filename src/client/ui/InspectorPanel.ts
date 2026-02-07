import { AgentData } from '@shared/Types';
import { buildAgentIdentityToken } from './AgentIdentity';
import { appendRelationshipSample, renderRelationshipSparkline } from './RelationshipSparkline';
import { UIPanel, UISimulationState } from './types';

interface InspectorOptions {
  getSelectedAgentId: () => string | null;
}

function formatAgent(agent: AgentData, relationshipTrend: string): string {
  const relationship = agent.relationshipSummary;

  return [
    `name: ${agent.name}`,
    `occupation: ${agent.occupation ?? 'Townsperson'}`,
    `state: ${agent.state}`,
    `tile: ${agent.tilePosition.tileX},${agent.tilePosition.tileY}`,
    `action: ${agent.currentAction ?? 'n/a'}`,
    `mood/energy/hunger: ${Math.round(agent.mood ?? 0)}/${Math.round(agent.energy ?? 0)}/${Math.round(agent.hunger ?? 0)}`,
    `goal: ${agent.currentGoal ?? 'n/a'}`,
    `plan: ${(agent.currentPlan ?? []).join(' | ') || 'n/a'}`,
    `reflection: ${agent.lastReflection ?? 'n/a'}`,
    `relationships: friends ${relationship?.friendCount ?? 0}, rivals ${relationship?.rivalCount ?? 0}, avg ${relationship?.averageWeight ?? 0}`,
    `relationship trend (1h): ${relationshipTrend}`,
    `llm: ${agent.llmTrace?.lastOutcome ?? 'n/a'}`,
  ].join('\n');
}

export function appendRelationshipSummarySamples(
  historyByAgent: Map<string, number[]>,
  agents: AgentData[],
  currentTickId: number,
  sampledTickByAgent: Map<string, number>,
  maxSamples = 24,
): void {
  for (const agent of agents) {
    const value = agent.relationshipSummary?.averageWeight;
    if (typeof value !== 'number') {
      continue;
    }
    if (sampledTickByAgent.get(agent.id) === currentTickId) {
      continue;
    }
    const current = historyByAgent.get(agent.id) ?? [];
    historyByAgent.set(agent.id, appendRelationshipSample(current, value, maxSamples));
    sampledTickByAgent.set(agent.id, currentTickId);
  }
}

export class InspectorPanel implements UIPanel {
  readonly id = 'inspector-panel';
  readonly element: HTMLElement;

  private readonly contentElement: HTMLElement;
  private readonly identityElement: HTMLElement;
  private readonly trendElement: HTMLElement;
  private readonly getSelectedAgentId: () => string | null;
  private readonly relationshipHistoryByAgent = new Map<string, number[]>();
  private readonly sampledRelationshipTickByAgent = new Map<string, number>();

  constructor(options: InspectorOptions) {
    this.getSelectedAgentId = options.getSelectedAgentId;

    this.element = document.createElement('section');
    this.element.className = 'ui-panel inspector-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Inspector';

    this.identityElement = document.createElement('div');
    this.identityElement.className = 'inspector-identity';

    this.trendElement = document.createElement('div');
    this.trendElement.className = 'panel-subheader inspector-trend';

    this.contentElement = document.createElement('pre');
    this.contentElement.className = 'inspector-content';

    this.element.append(header, this.identityElement, this.trendElement, this.contentElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    appendRelationshipSummarySamples(
      this.relationshipHistoryByAgent,
      state.agents,
      state.tickId,
      this.sampledRelationshipTickByAgent,
    );
    this.captureRelationshipSamples(state.events);

    const selectedAgentId = this.getSelectedAgentId();
    if (!selectedAgentId) {
      this.contentElement.textContent = 'No agent selected';
      this.trendElement.textContent = '';
      return;
    }

    const agent = state.agents.find((candidate) => candidate.id === selectedAgentId);
    if (!agent) {
      this.contentElement.textContent = `Agent ${selectedAgentId} not found in latest state`;
      this.identityElement.innerHTML = '';
      this.trendElement.textContent = '';
      return;
    }

    const identity = buildAgentIdentityToken(agent);
    this.identityElement.innerHTML = '';
    const portrait = document.createElement('div');
    portrait.className = 'identity-portrait';
    portrait.textContent = identity.initials;
    portrait.style.background = identity.gradient;
    portrait.style.borderColor = identity.border;

    const badge = document.createElement('div');
    badge.className = 'identity-role-badge';
    badge.textContent = identity.roleBadge;

    this.identityElement.append(portrait, badge);
    const sparkline = renderRelationshipSparkline(this.relationshipHistoryByAgent.get(agent.id) ?? []);
    this.trendElement.textContent = `Relationship timeline: ${sparkline}`;
    this.contentElement.textContent = formatAgent(agent, sparkline);
  }

  destroy(): void {
    this.element.remove();
  }

  private captureRelationshipSamples(events: unknown[]): void {
    for (const event of events) {
      if (!event || typeof event !== 'object') {
        continue;
      }

      const typed = event as Record<string, unknown>;
      if (typed.type !== 'relationshipShift') {
        continue;
      }

      if (typeof typed.sourceId !== 'string' || typeof typed.toWeight !== 'number') {
        continue;
      }

      const current = this.relationshipHistoryByAgent.get(typed.sourceId) ?? [];
      this.relationshipHistoryByAgent.set(typed.sourceId, appendRelationshipSample(current, typed.toWeight, 24));
    }
  }
}
