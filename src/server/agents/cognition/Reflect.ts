import { LogEvent } from '@shared/Events';
import { GameTime } from '@shared/Types';
import { MemoryStream } from '../../memory/MemoryStream';
import { Memory, MemoryType } from '../../memory/Types';
import { Agent } from '../Agent';

interface ReflectionResult {
  created: boolean;
  reflectionText?: string;
  log?: LogEvent;
}

export class ReflectionSystem {
  private readonly reflectionIntervalMinutes: number;
  private readonly lastReflectionByAgent = new Map<string, number>();

  constructor(intervalHours = 12) {
    this.reflectionIntervalMinutes = Math.max(1, intervalHours) * 60;
  }

  maybeReflect(agent: Agent, memory: MemoryStream, gameTime: GameTime): ReflectionResult {
    const lastReflectionAt = this.getLastReflectionMinute(agent.id, memory);
    const minutesSince = gameTime.totalMinutes - lastReflectionAt;
    if (minutesSince < this.reflectionIntervalMinutes) {
      return { created: false };
    }

    const observations = memory
      .getByTimeRange(lastReflectionAt, gameTime.totalMinutes)
      .filter((item) => item.type === MemoryType.Observation && !item.isArchived);

    const top = [...observations]
      .sort((left, right) => right.importance - left.importance || right.timestamp - left.timestamp)
      .slice(0, 8);

    const reflectionText = this.composeReflection(agent, top);
    const created = memory.addReflection(
      reflectionText,
      gameTime.totalMinutes,
      top.map((item) => item.id),
    );
    created.importance = top.length >= 3 ? 7 : 4;

    this.lastReflectionByAgent.set(agent.id, gameTime.totalMinutes);

    return {
      created: true,
      reflectionText,
      log: {
        type: 'log',
        level: 'info',
        agentId: agent.id,
        gameTime,
        message: `Reflection added for ${agent.name}`,
      },
    };
  }

  getLatestReflection(memory: MemoryStream): string | null {
    const latest = memory
      .getByType(MemoryType.Reflection)
      .sort((left, right) => right.timestamp - left.timestamp)[0];
    return latest?.content ?? null;
  }

  private getLastReflectionMinute(agentId: string, memory: MemoryStream): number {
    const tracked = this.lastReflectionByAgent.get(agentId);
    if (typeof tracked === 'number') {
      return tracked;
    }

    const latest = memory
      .getByType(MemoryType.Reflection)
      .sort((left, right) => right.timestamp - left.timestamp)[0];

    const resolved = latest?.timestamp ?? 0;
    this.lastReflectionByAgent.set(agentId, resolved);
    return resolved;
  }

  private composeReflection(agent: Agent, memories: Memory[]): string {
    if (memories.length === 0) {
      return `${agent.name} notes a quiet stretch and decides to stay observant.`;
    }

    const locations = [...new Set(memories.map((memory) => memory.location))].slice(0, 3);
    const subjects = [...new Set(memories.flatMap((memory) => memory.subjects))].filter((id) => id !== agent.id);
    const strongest = memories[0];

    const locationText = locations.length > 0 ? `around ${locations.join(', ')}` : 'throughout town';
    const subjectText = subjects.length > 0 ? ` with ${subjects.slice(0, 3).join(', ')}` : '';

    return `${agent.name} reflects on recent events ${locationText}${subjectText}, especially: "${strongest.content}".`;
  }
}
