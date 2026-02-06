import { AgentData } from '@shared/Types';
import { Agent } from './Agent';

export class AgentManager {
  private readonly agents = new Map<string, Agent>();

  constructor(initialAgents: Agent[] = []) {
    for (const agent of initialAgents) {
      this.agents.set(agent.id, agent);
    }
  }

  add(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  getById(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAll(): Agent[] {
    return [...this.agents.values()];
  }

  update(deltaMs: number): void {
    for (const agent of this.agents.values()) {
      agent.update(deltaMs);
    }
  }

  toAgentDataArray(): AgentData[] {
    return this.getAll().map((agent) => agent.toAgentData());
  }

  getNearbyPairs(maxTileDistance: number): Array<[Agent, Agent]> {
    const output: Array<[Agent, Agent]> = [];
    const agents = this.getAll();

    for (let i = 0; i < agents.length; i += 1) {
      for (let j = i + 1; j < agents.length; j += 1) {
        const a = agents[i].getTilePosition();
        const b = agents[j].getTilePosition();

        const distance = Math.abs(a.tileX - b.tileX) + Math.abs(a.tileY - b.tileY);
        if (distance <= maxTileDistance) {
          output.push([agents[i], agents[j]]);
        }
      }
    }

    return output;
  }
}
