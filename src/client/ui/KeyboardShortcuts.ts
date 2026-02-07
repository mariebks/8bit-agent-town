export type PanelShortcutTarget =
  | 'debug-panel'
  | 'inspector-panel'
  | 'prompt-viewer'
  | 'log-panel'
  | 'timeline-panel'
  | 'time-controls'
  | 'relationship-heatmap-panel';
export type OverlayShortcutTarget = 'path-overlay' | 'perception-overlay';
export type ModeShortcutTarget = 'cycle-ui-mode' | 'cycle-ui-density';
export type UtilityShortcutTarget = 'toggle-focus-ui' | 'focus-agent-finder';

export interface ShortcutInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  targetTagName?: string | null;
  targetIsContentEditable?: boolean;
}

export function resolvePanelShortcut(input: ShortcutInput): PanelShortcutTarget | null {
  if (input.ctrlKey || input.metaKey || input.altKey) {
    return null;
  }

  if (isEditableTarget(input.targetTagName, input.targetIsContentEditable)) {
    return null;
  }

  const key = input.key.toLowerCase();
  if (key === 'd') {
    return 'debug-panel';
  }
  if (key === 'i') {
    return 'inspector-panel';
  }
  if (key === 'p') {
    return 'prompt-viewer';
  }
  if (key === 'l') {
    return 'log-panel';
  }
  if (key === 't') {
    return 'timeline-panel';
  }
  if (key === 'c') {
    return 'time-controls';
  }
  if (key === 'h') {
    return 'relationship-heatmap-panel';
  }
  return null;
}

export function resolveOverlayShortcut(input: ShortcutInput): OverlayShortcutTarget | null {
  if (input.ctrlKey || input.metaKey || input.altKey) {
    return null;
  }

  if (isEditableTarget(input.targetTagName, input.targetIsContentEditable)) {
    return null;
  }

  const key = input.key.toLowerCase();
  if (key === 'v') {
    return 'path-overlay';
  }
  if (key === 'r') {
    return 'perception-overlay';
  }
  return null;
}

export function resolveModeShortcut(input: ShortcutInput): ModeShortcutTarget | null {
  if (input.ctrlKey || input.metaKey || input.altKey) {
    return null;
  }

  if (isEditableTarget(input.targetTagName, input.targetIsContentEditable)) {
    return null;
  }

  if (input.key.toLowerCase() === 'm') {
    return 'cycle-ui-mode';
  }
  if (input.key.toLowerCase() === 'n') {
    return 'cycle-ui-density';
  }
  return null;
}

export function resolveUtilityShortcut(input: ShortcutInput): UtilityShortcutTarget | null {
  if (input.ctrlKey || input.metaKey || input.altKey) {
    return null;
  }

  const key = input.key.toLowerCase();
  if (key === '/' && !isEditableTarget(input.targetTagName, input.targetIsContentEditable)) {
    return 'focus-agent-finder';
  }
  if (key === 'f' && input.shiftKey && !isEditableTarget(input.targetTagName, input.targetIsContentEditable)) {
    return 'toggle-focus-ui';
  }
  return null;
}

function isEditableTarget(tagName?: string | null, isContentEditable?: boolean): boolean {
  if (isContentEditable) {
    return true;
  }

  const normalizedTag = (tagName ?? '').toLowerCase();
  return normalizedTag === 'input' || normalizedTag === 'textarea' || normalizedTag === 'select';
}
