import { AgentData } from '@shared/Types';
import { buildAgentIdentityToken } from './AgentIdentity';
import { UIPanel, UISimulationState } from './types';

interface InspectorOptions {
  getSelectedAgentId: () => string | null;
}

function formatAgent(agent: AgentData): string {
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
    `llm: ${agent.llmTrace?.lastOutcome ?? 'n/a'}`,
  ].join('\n');
}

export class InspectorPanel implements UIPanel {
  readonly id = 'inspector-panel';
  readonly element: HTMLElement;

  private readonly contentElement: HTMLElement;
  private readonly identityElement: HTMLElement;
  private readonly getSelectedAgentId: () => string | null;

  constructor(options: InspectorOptions) {
    this.getSelectedAgentId = options.getSelectedAgentId;

    this.element = document.createElement('section');
    this.element.className = 'ui-panel inspector-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Inspector';

    this.identityElement = document.createElement('div');
    this.identityElement.className = 'inspector-identity';

    this.contentElement = document.createElement('pre');
    this.contentElement.className = 'inspector-content';

    this.element.append(header, this.identityElement, this.contentElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    const selectedAgentId = this.getSelectedAgentId();
    if (!selectedAgentId) {
      this.contentElement.textContent = 'No agent selected';
      return;
    }

    const agent = state.agents.find((candidate) => candidate.id === selectedAgentId);
    if (!agent) {
      this.contentElement.textContent = `Agent ${selectedAgentId} not found in latest state`;
      this.identityElement.innerHTML = '';
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
    this.contentElement.textContent = formatAgent(agent);
  }

  destroy(): void {
    this.element.remove();
  }
}
