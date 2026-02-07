export type PanelShortcutTarget = 'debug-panel' | 'inspector-panel' | 'prompt-viewer' | 'log-panel';
export type OverlayShortcutTarget = 'path-overlay' | 'perception-overlay';

export interface ShortcutInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
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

function isEditableTarget(tagName?: string | null, isContentEditable?: boolean): boolean {
  if (isContentEditable) {
    return true;
  }

  const normalizedTag = (tagName ?? '').toLowerCase();
  return normalizedTag === 'input' || normalizedTag === 'textarea' || normalizedTag === 'select';
}
