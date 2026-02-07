export interface QueuedSpeech {
  message: string;
  durationMs: number;
}

export function enqueueSpeech(queue: QueuedSpeech[], item: QueuedSpeech, maxQueueSize = 2): QueuedSpeech[] {
  const next = [...queue, item];
  if (next.length <= maxQueueSize) {
    return next;
  }
  return next.slice(next.length - maxQueueSize);
}
