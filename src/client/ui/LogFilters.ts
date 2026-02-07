export interface ParsedLogEvent {
  type: string;
  agentId?: string;
  text: string;
}

export interface FilterableLogEntry {
  type: string;
  agentId?: string;
}

export function parseLogEvent(event: unknown): ParsedLogEvent {
  if (!event || typeof event !== 'object') {
    return {
      type: 'event',
      text: String(event),
    };
  }

  const typed = event as Record<string, unknown>;
  const type = typeof typed.type === 'string' ? typed.type : 'event';
  const agentId = resolveAgentId(typed);

  if (type === 'conversationTurn') {
    return {
      type,
      agentId: typeof typed.speakerId === 'string' ? typed.speakerId : agentId,
      text: `${type}: ${String(typed.speakerId ?? 'agent')} -> ${String(typed.message ?? '')}`,
    };
  }

  if (type === 'relationshipShift') {
    return {
      type,
      agentId: typeof typed.sourceId === 'string' ? typed.sourceId : agentId,
      text: `relationship: ${String(typed.sourceId ?? 'agent')} -> ${String(typed.targetId ?? 'agent')} (${String(typed.stance ?? 'changed')})`,
    };
  }

  if (type === 'locationArrival') {
    return {
      type,
      agentId: typeof typed.agentId === 'string' ? typed.agentId : agentId,
      text: `arrival: ${String(typed.agentId ?? 'agent')} -> ${String(typed.locationId ?? 'unknown')}`,
    };
  }

  if (type === 'topicSpread') {
    return {
      type,
      agentId: typeof typed.sourceId === 'string' ? typed.sourceId : agentId,
      text: `topic: ${String(typed.sourceId ?? 'agent')} -> ${String(typed.targetId ?? 'agent')} (${String(typed.topic ?? 'topic')})`,
    };
  }

  if (type === 'log') {
    return {
      type,
      agentId,
      text: `log/${String(typed.level ?? 'info')}: ${String(typed.message ?? '')}`,
    };
  }

  return {
    type,
    agentId,
    text: `${type}`,
  };
}

export function filterLogEntries<T extends FilterableLogEntry>(
  entries: T[],
  typeFilter: string,
  agentFilterText: string,
): T[] {
  const normalizedAgentFilter = agentFilterText.trim().toLowerCase();

  return entries.filter((entry) => {
    if (typeFilter !== 'all' && entry.type !== typeFilter) {
      return false;
    }

    if (!normalizedAgentFilter) {
      return true;
    }

    return (entry.agentId ?? '').toLowerCase().includes(normalizedAgentFilter);
  });
}

function resolveAgentId(event: Record<string, unknown>): string | undefined {
  if (typeof event.agentId === 'string') {
    return event.agentId;
  }

  if (typeof event.speakerId === 'string') {
    return event.speakerId;
  }

  return undefined;
}
