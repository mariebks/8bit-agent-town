import { LogEvent } from '@shared/Events';
import { GameTime, LocationData, LocationId } from '@shared/Types';
import { MemoryStream } from '../../memory/MemoryStream';
import { PlanItem, PlanMemory } from '../../memory/Types';
import { SeededRng } from '../../util/SeededRng';
import { Agent } from '../Agent';

const MINUTES_PER_DAY = 24 * 60;
const MORNING_PLAN_HOUR = 6;

interface PlanningResult {
  created: boolean;
  plan?: PlanMemory;
  log?: LogEvent;
}

export class PlanningSystem {
  private readonly rng: SeededRng;
  private readonly plannedDayByAgent = new Map<string, number>();

  constructor(seed: number) {
    this.rng = new SeededRng(seed);
  }

  ensureDailyPlan(agent: Agent, memory: MemoryStream, gameTime: GameTime, locations: LocationData[]): PlanningResult {
    const alreadyPlannedDay = this.plannedDayByAgent.get(agent.id);
    if (alreadyPlannedDay === gameTime.day) {
      return { created: false };
    }

    if (gameTime.hour < MORNING_PLAN_HOUR) {
      return { created: false };
    }

    const planItems = this.generateFallbackPlan(agent, gameTime, locations);
    const plan = memory.addPlan(planItems, gameTime.totalMinutes, (gameTime.day + 1) * MINUTES_PER_DAY);

    this.plannedDayByAgent.set(agent.id, gameTime.day);

    return {
      created: true,
      plan,
      log: {
        type: 'log',
        level: 'info',
        agentId: agent.id,
        gameTime,
        message: `Generated daily plan for ${agent.name}`,
      },
    };
  }

  getCurrentGoal(memory: MemoryStream, currentTime: number): string | null {
    const nextItem = this.getNextPlanItem(memory, currentTime);
    return nextItem?.description ?? null;
  }

  getPlanPreview(memory: MemoryStream, currentTime: number, limit = 3): string[] {
    const plan = memory.getCurrentPlan(currentTime);
    if (!plan) {
      return [];
    }

    return plan.planItems
      .filter((item) => item.status === 'pending' || item.status === 'active')
      .sort((left, right) => (left.targetTime ?? Number.MAX_SAFE_INTEGER) - (right.targetTime ?? Number.MAX_SAFE_INTEGER))
      .slice(0, limit)
      .map((item) => item.description);
  }

  getNextPlanItem(memory: MemoryStream, currentTime: number): PlanItem | null {
    const plan = memory.getCurrentPlan(currentTime);
    if (!plan) {
      return null;
    }

    const dueWindow = currentTime + 30;
    const candidates = plan.planItems
      .filter((item) => item.status === 'pending' || item.status === 'active')
      .filter((item) => !item.targetTime || item.targetTime <= dueWindow)
      .sort((left, right) => {
        const leftStatus = left.status === 'active' ? 0 : 1;
        const rightStatus = right.status === 'active' ? 0 : 1;
        if (leftStatus !== rightStatus) {
          return leftStatus - rightStatus;
        }
        return (left.targetTime ?? Number.MAX_SAFE_INTEGER) - (right.targetTime ?? Number.MAX_SAFE_INTEGER);
      });

    return candidates[0] ?? null;
  }

  markPlanItemStatus(memory: MemoryStream, currentTime: number, itemId: string, status: PlanItem['status']): void {
    const plan = memory.getCurrentPlan(currentTime);
    if (!plan) {
      return;
    }

    for (const item of plan.planItems) {
      if (item.id === itemId) {
        item.status = status;
        return;
      }
    }
  }

  private generateFallbackPlan(agent: Agent, gameTime: GameTime, locations: LocationData[]): PlanItem[] {
    const dayStart = gameTime.day * MINUTES_PER_DAY;
    const home = this.resolveLocation(agent.profile.homeLocation, locations, 'plaza');
    const workplace = this.resolveLocation(agent.profile.occupation.workplace, locations, home);
    const lunch = this.pickByTags(locations, ['food', 'social'], home);
    const social = this.pickByTags(locations, ['social'], 'plaza');
    const quiet = this.pickByTags(locations, ['quiet'], home);

    const startHour = agent.profile.occupation.schedule?.start ?? this.rng.range(8, 10);
    const endHour = agent.profile.occupation.schedule?.end ?? startHour + 7;

    return [
      this.planItem(agent.id, gameTime.day, 0, 'Breakfast and get ready for the day', home, dayStart + 7 * 60, 4),
      this.planItem(
        agent.id,
        gameTime.day,
        1,
        `Start ${agent.profile.occupation.id} routine`,
        workplace,
        dayStart + startHour * 60,
        5,
      ),
      this.planItem(agent.id, gameTime.day, 2, 'Lunch break and reset', lunch, dayStart + 12 * 60, 4),
      this.planItem(
        agent.id,
        gameTime.day,
        3,
        `Afternoon focus at ${workplace.replace('_', ' ')}`,
        workplace,
        dayStart + Math.min(endHour - 1, 16) * 60,
        4,
      ),
      this.planItem(agent.id, gameTime.day, 4, 'Social time in town', social, dayStart + 18 * 60, 3),
      this.planItem(agent.id, gameTime.day, 5, 'Wind down and rest', quiet, dayStart + 21 * 60, 3),
    ];
  }

  private planItem(
    agentId: string,
    day: number,
    index: number,
    description: string,
    targetLocation: LocationId,
    targetTime: number,
    priority: number,
  ): PlanItem {
    return {
      id: `${agentId}-plan-${day}-${index}`,
      description,
      targetLocation,
      targetTime,
      priority,
      status: 'pending',
    };
  }

  private resolveLocation(candidate: LocationId | null, locations: LocationData[], fallback: LocationId): LocationId {
    if (candidate && locations.some((location) => location.id === candidate)) {
      return candidate;
    }
    return fallback;
  }

  private pickByTags(locations: LocationData[], tags: string[], fallback: LocationId): LocationId {
    for (const location of locations) {
      if (tags.every((tag) => location.tags.includes(tag))) {
        return location.id;
      }
    }

    const alternatives = locations.filter((location) => tags.some((tag) => location.tags.includes(tag)));
    if (alternatives.length > 0) {
      return this.rng.pick(alternatives).id;
    }

    return fallback;
  }
}
