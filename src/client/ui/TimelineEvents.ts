interface AgentLabel {
  id: string;
  name?: string;
}

export type TimelineEventKind = 'plan' | 'reflection' | 'conversation' | 'relationship' | 'arrival' | 'topic' | 'system';

export interface TimelineEntry {
  id: string;
  tickId: number;
  kind: TimelineEventKind;
  headline: string;
  detail?: string;
  agentId?: string;
  actorIds: string[];
}

interface TimelineContext {
  tickId: number;
  agents: AgentLabel[];
}

const CONVERSATION_END_REASON_TEXT: Record<string, string> = {
  maxTurns: 'topic exhausted',
  agentEnded: 'someone ended it',
  timeout: 'timeout',
  interrupted: 'interrupted',
  topicExhausted: 'topic exhausted',
  schedulePressure: 'schedule pressure',
  socialDiscomfort: 'social discomfort',
};

export function extractTimelineEntries(events: unknown[], context: TimelineContext): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const event of events) {
    const entry = toTimelineEntry(event, context);
    if (!entry) {
      continue;
    }
    entries.push(entry);
  }

  return dedupeTimelineEntries(entries);
}

function toTimelineEntry(event: unknown, context: TimelineContext): TimelineEntry | null {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const typed = event as Record<string, unknown>;
  const type = typed.type;
  if (typeof type !== 'string') {
    return null;
  }

  if (type === 'conversationStart') {
    const participants = Array.isArray(typed.participants) ? typed.participants : [];
    const a = typeof participants[0] === 'string' ? participants[0] : 'agent';
    const b = typeof participants[1] === 'string' ? participants[1] : 'agent';
    const aName = resolveAgentName(context.agents, a);
    const bName = resolveAgentName(context.agents, b);
    const location = typeof typed.location === 'string' ? typed.location : 'town';

    return {
      id: `${context.tickId}:conversationStart:${typed.conversationId ?? `${a}:${b}`}`,
      tickId: context.tickId,
      kind: 'conversation',
      headline: `${aName} and ${bName} started talking`,
      detail: `location: ${humanizeToken(location)}`,
      actorIds: [a, b],
      agentId: a,
    };
  }

  if (type === 'conversationEnd') {
    const reasonKey = typeof typed.reason === 'string' ? typed.reason : 'interrupted';
    return {
      id: `${context.tickId}:conversationEnd:${typed.conversationId ?? 'unknown'}`,
      tickId: context.tickId,
      kind: 'conversation',
      headline: 'Conversation ended',
      detail: CONVERSATION_END_REASON_TEXT[reasonKey] ?? reasonKey,
      actorIds: [],
    };
  }

  if (type === 'relationshipShift') {
    const sourceId = typeof typed.sourceId === 'string' ? typed.sourceId : 'agent';
    const targetId = typeof typed.targetId === 'string' ? typed.targetId : 'agent';
    const stance = typeof typed.stance === 'string' ? typed.stance : 'acquaintance';
    return {
      id: `${context.tickId}:relationship:${sourceId}:${targetId}:${stance}`,
      tickId: context.tickId,
      kind: 'relationship',
      headline: `${resolveAgentName(context.agents, sourceId)} now sees ${resolveAgentName(context.agents, targetId)} as ${stance}`,
      detail: `weight: ${typed.fromWeight ?? '?'} -> ${typed.toWeight ?? '?'}`,
      actorIds: [sourceId, targetId],
      agentId: sourceId,
    };
  }

  if (type === 'locationArrival') {
    const agentId = typeof typed.agentId === 'string' ? typed.agentId : 'agent';
    const locationId = typeof typed.locationId === 'string' ? typed.locationId : 'town';
    return {
      id: `${context.tickId}:arrival:${agentId}:${locationId}`,
      tickId: context.tickId,
      kind: 'arrival',
      headline: `${resolveAgentName(context.agents, agentId)} arrived at ${humanizeToken(locationId)}`,
      actorIds: [agentId],
      agentId,
    };
  }

  if (type === 'topicSpread') {
    const sourceId = typeof typed.sourceId === 'string' ? typed.sourceId : 'agent';
    const targetId = typeof typed.targetId === 'string' ? typed.targetId : 'agent';
    const topic = typeof typed.topic === 'string' ? typed.topic : 'topic';
    return {
      id: `${context.tickId}:topic:${sourceId}:${targetId}:${topic}`,
      tickId: context.tickId,
      kind: 'topic',
      headline: `${resolveAgentName(context.agents, sourceId)} shared "${topic}" with ${resolveAgentName(context.agents, targetId)}`,
      detail: `confidence: ${typed.confidence ?? 'n/a'}`,
      actorIds: [sourceId, targetId],
      agentId: sourceId,
    };
  }

  if (type === 'log') {
    const message = typeof typed.message === 'string' ? typed.message : '';
    const agentId = typeof typed.agentId === 'string' ? typed.agentId : undefined;

    if (message.startsWith('Generated daily plan for')) {
      return {
        id: `${context.tickId}:plan:${agentId ?? message}`,
        tickId: context.tickId,
        kind: 'plan',
        headline: message,
        actorIds: agentId ? [agentId] : [],
        agentId,
      };
    }

    if (message.startsWith('Reflection added for')) {
      return {
        id: `${context.tickId}:reflection:${agentId ?? message}`,
        tickId: context.tickId,
        kind: 'reflection',
        headline: message,
        actorIds: agentId ? [agentId] : [],
        agentId,
      };
    }

    if (message.startsWith('control accepted:') || message.startsWith('control rejected:')) {
      return {
        id: `${context.tickId}:system:${message}`,
        tickId: context.tickId,
        kind: 'system',
        headline: message,
        actorIds: [],
      };
    }
  }

  return null;
}

function dedupeTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const seen = new Set<string>();
  const output: TimelineEntry[] = [];

  for (const entry of entries) {
    const signature = `${entry.tickId}:${entry.kind}:${entry.headline}`;
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    output.push(entry);
  }

  return output;
}

function resolveAgentName(agents: AgentLabel[], agentId: string): string {
  return agents.find((agent) => agent.id === agentId)?.name ?? agentId;
}

function humanizeToken(value: string): string {
  return value.replace(/_/g, ' ');
}
