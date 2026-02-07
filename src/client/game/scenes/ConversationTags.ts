export function inferConversationTags(message: string): string[] {
  const normalized = message.toLowerCase();
  const tags: string[] = [];

  if (containsAny(normalized, ['heard', 'rumor', 'around town', 'shared', 'news', 'gossip'])) {
    tags.push('gossip');
  }
  if (containsAny(normalized, ['plan', 'schedule', 'should', 'next step', 'task', 'goal'])) {
    tags.push('plan');
  }
  if (containsAny(normalized, ['listen', 'honestly', 'upset', 'angry', 'tension', 'conflict'])) {
    tags.push('conflict');
  }
  if (containsAny(normalized, ['glad', 'good to see', 'thanks', 'great', 'friendly'])) {
    tags.push('friendly');
  }
  if (containsAny(normalized, ['urgent', 'quickly', 'right now', 'soon', 'late'])) {
    tags.push('urgent');
  }

  if (tags.length === 0) {
    tags.push('chat');
  }

  return tags.slice(0, 2);
}

function containsAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}
