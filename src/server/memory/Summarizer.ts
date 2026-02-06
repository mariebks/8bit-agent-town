import { MemorySource, ObservationInput } from './Types';

export class Summarizer {
  summarizeConversation(messages: string[], speakerIds: string[], gameTime: number, location: string): ObservationInput {
    const topMessages = messages.slice(0, 4).map((message) => message.trim()).filter(Boolean);
    const joined = topMessages.join(' | ');
    const content = joined.length > 0 ? `Conversation summary: ${joined}` : 'Conversation summary: brief exchange.';

    return {
      content,
      gameTime,
      location,
      subjects: [...new Set(speakerIds)],
      source: MemorySource.Dialogue,
      importance: Math.min(10, Math.max(4, Math.round(messages.length / 2))),
    };
  }
}
