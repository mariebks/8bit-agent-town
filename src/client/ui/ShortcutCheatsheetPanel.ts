import { UIPanel, UISimulationState } from './types';

export class ShortcutCheatsheetPanel implements UIPanel {
  readonly id = 'shortcut-cheatsheet-panel';
  readonly element: HTMLElement;

  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'ui-panel shortcut-cheatsheet-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Keyboard Shortcuts';

    const list = document.createElement('div');
    list.className = 'shortcut-list';
    const rows: Array<{ key: string; action: string }> = [
      { key: '?', action: 'Toggle this help' },
      { key: '/', action: 'Focus Agent Finder input' },
      { key: 'Shift+F', action: 'Toggle Focus UI declutter' },
      { key: 'J', action: 'Jump to Next Event Agent' },
      { key: 'K / G', action: 'Bookmark selected / jump next bookmark' },
      { key: 'B', action: 'Toggle Selected Speech mode' },
      { key: 'Esc', action: 'Clear selected agent and Follow' },
      { key: 'M / N', action: 'Cycle mode / density' },
      { key: 'D I P L T C H', action: 'Toggle panels' },
      { key: 'V / R', action: 'Toggle debug overlays' },
    ];

    for (const row of rows) {
      const item = document.createElement('div');
      item.className = 'shortcut-row';
      const key = document.createElement('span');
      key.className = 'shortcut-key';
      key.textContent = row.key;
      const action = document.createElement('span');
      action.className = 'shortcut-action';
      action.textContent = row.action;
      item.append(key, action);
      list.append(item);
    }

    const footer = document.createElement('div');
    footer.className = 'panel-footer';
    footer.textContent = 'Tip: shortcuts are disabled while typing in inputs.';

    this.element.append(header, list, footer);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(_state: UISimulationState): void {
    // Static panel.
  }

  destroy(): void {
    this.element.remove();
  }
}
