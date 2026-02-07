import { describe, expect, test } from 'vitest';
import { resolvePanelShortcut } from './KeyboardShortcuts';

describe('KeyboardShortcuts', () => {
  test('maps supported keys to panel toggles', () => {
    expect(resolvePanelShortcut({ key: 'd' })).toBe('debug-panel');
    expect(resolvePanelShortcut({ key: 'I' })).toBe('inspector-panel');
    expect(resolvePanelShortcut({ key: 'p' })).toBe('prompt-viewer');
    expect(resolvePanelShortcut({ key: 'l' })).toBe('log-panel');
  });

  test('ignores shortcuts with modifier keys', () => {
    expect(resolvePanelShortcut({ key: 'd', ctrlKey: true })).toBeNull();
    expect(resolvePanelShortcut({ key: 'i', metaKey: true })).toBeNull();
    expect(resolvePanelShortcut({ key: 'p', altKey: true })).toBeNull();
  });

  test('ignores shortcuts while typing in editable elements', () => {
    expect(resolvePanelShortcut({ key: 'd', targetTagName: 'input' })).toBeNull();
    expect(resolvePanelShortcut({ key: 'd', targetTagName: 'textarea' })).toBeNull();
    expect(resolvePanelShortcut({ key: 'd', targetTagName: 'select' })).toBeNull();
    expect(resolvePanelShortcut({ key: 'd', targetIsContentEditable: true })).toBeNull();
  });
});
