import { describe, expect, test } from 'vitest';
import { formatSpeechBubbleText } from './SpeechBubbleText';

describe('SpeechBubbleText', () => {
  test('returns normalized text unchanged when within limit', () => {
    const formatted = formatSpeechBubbleText('Hello   there', 40);
    expect(formatted.body).toBe('Hello there');
    expect(formatted.truncated).toBe(false);
    expect(formatted.hint).toBeNull();
  });

  test('truncates and adds hint when message exceeds expanded limit', () => {
    const message = 'a'.repeat(320);
    const formatted = formatSpeechBubbleText(message, 60, false, 120);
    expect(formatted.body.endsWith('…')).toBe(true);
    expect(formatted.body.length).toBeLessThanOrEqual(60);
    expect(formatted.truncated).toBe(true);
    expect(formatted.hint).toBe('Select this agent for full quote.');
  });

  test('keeps long text in full when within expanded threshold', () => {
    const message = 'b'.repeat(180);
    const formatted = formatSpeechBubbleText(message, 90, true, 220);
    expect(formatted.body.length).toBe(180);
    expect(formatted.truncated).toBe(false);
    expect(formatted.hint).toBeNull();
  });

  test('uses expanded truncation limit when selected quote is still too long', () => {
    const message = 'c'.repeat(320);
    const formatted = formatSpeechBubbleText(message, 90, true, 220);
    expect(formatted.body.endsWith('…')).toBe(true);
    expect(formatted.body.length).toBeLessThanOrEqual(220);
    expect(formatted.hint).toBeNull();
  });
});
