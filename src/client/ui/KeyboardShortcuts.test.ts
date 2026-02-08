import { describe, expect, test } from 'vitest';
import { resolveModeShortcut, resolveOverlayShortcut, resolvePanelShortcut, resolveUtilityShortcut } from './KeyboardShortcuts';

describe('KeyboardShortcuts', () => {
  test('maps supported keys to panel toggles', () => {
    expect(resolvePanelShortcut({ key: 'd' })).toBe('debug-panel');
    expect(resolvePanelShortcut({ key: 'I' })).toBe('inspector-panel');
    expect(resolvePanelShortcut({ key: 'p' })).toBe('prompt-viewer');
    expect(resolvePanelShortcut({ key: 'l' })).toBe('log-panel');
    expect(resolvePanelShortcut({ key: 't' })).toBe('timeline-panel');
    expect(resolvePanelShortcut({ key: 'c' })).toBe('time-controls');
    expect(resolvePanelShortcut({ key: 'h' })).toBe('relationship-heatmap-panel');
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

  test('maps overlay toggle keys', () => {
    expect(resolveOverlayShortcut({ key: 'v' })).toBe('path-overlay');
    expect(resolveOverlayShortcut({ key: 'R' })).toBe('perception-overlay');
  });

  test('maps ui mode cycle shortcut', () => {
    expect(resolveModeShortcut({ key: 'm' })).toBe('cycle-ui-mode');
    expect(resolveModeShortcut({ key: 'n' })).toBe('cycle-ui-density');
    expect(resolveModeShortcut({ key: 'm', ctrlKey: true })).toBeNull();
  });

  test('maps utility shortcuts for focus ui and finder input', () => {
    expect(resolveUtilityShortcut({ key: '/', targetTagName: 'div' })).toBe('focus-agent-finder');
    expect(resolveUtilityShortcut({ key: '?', targetTagName: 'div' })).toBe('toggle-shortcuts-panel');
    expect(resolveUtilityShortcut({ key: 'F', shiftKey: true, targetTagName: 'div' })).toBe('toggle-focus-ui');
    expect(resolveUtilityShortcut({ key: 'j', targetTagName: 'div' })).toBe('jump-interesting-agent');
    expect(resolveUtilityShortcut({ key: 'k', targetTagName: 'div' })).toBe('add-bookmark');
    expect(resolveUtilityShortcut({ key: 'g', targetTagName: 'div' })).toBe('jump-bookmark');
    expect(resolveUtilityShortcut({ key: 'z', targetTagName: 'div' })).toBe('toggle-camera-pace');
    expect(resolveUtilityShortcut({ key: 'b', targetTagName: 'div' })).toBe('toggle-selected-only-speech');
    expect(resolveUtilityShortcut({ key: 'Escape', targetTagName: 'div' })).toBe('clear-selected-agent');
    expect(resolveUtilityShortcut({ key: '/', targetTagName: 'input' })).toBeNull();
    expect(resolveUtilityShortcut({ key: '?', targetTagName: 'input' })).toBeNull();
    expect(resolveUtilityShortcut({ key: 'k', targetTagName: 'input' })).toBeNull();
    expect(resolveUtilityShortcut({ key: 'z', targetTagName: 'input' })).toBeNull();
    expect(resolveUtilityShortcut({ key: 'b', targetTagName: 'input' })).toBeNull();
    expect(resolveUtilityShortcut({ key: 'Escape', targetTagName: 'textarea' })).toBeNull();
  });
});
