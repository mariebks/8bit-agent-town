export interface SpeechBubbleText {
  body: string;
  hint: string | null;
  truncated: boolean;
}

export function formatSpeechBubbleText(
  message: string,
  maxChars: number,
  expanded = false,
  expandedMaxChars = 260,
): SpeechBubbleText {
  const normalized = normalizeMessage(message);
  if (normalized.length <= maxChars) {
    return {
      body: normalized,
      hint: null,
      truncated: false,
    };
  }

  if (expanded && normalized.length <= expandedMaxChars) {
    return {
      body: normalized,
      hint: null,
      truncated: false,
    };
  }

  const sliced = normalized.slice(0, Math.max(1, maxChars - 1)).trimEnd();
  return {
    body: `${sliced}…`,
    hint: 'Select this agent for full quote.',
    truncated: true,
  };
}

function normalizeMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}
