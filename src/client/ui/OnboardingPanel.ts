import { UIPanel, UISimulationState } from './types';

const ONBOARDING_STORAGE_KEY = 'agent-town.ui.onboarding.dismissed';

export class OnboardingPanel implements UIPanel {
  readonly id = 'onboarding-panel';
  readonly element: HTMLElement;

  private readonly statusElement: HTMLElement;
  private dismissed = loadDismissedState();

  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'ui-panel onboarding-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Welcome to Agent Town';

    const steps = document.createElement('ol');
    steps.className = 'onboarding-steps';
    for (const text of [
      'Watch agents move through their day.',
      'Click any agent to inspect goals, memory, and relationships.',
      'Use Timeline + Follow to jump to interesting moments.',
    ]) {
      const item = document.createElement('li');
      item.textContent = text;
      steps.appendChild(item);
    }

    const actions = document.createElement('div');
    actions.className = 'time-controls-row';

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'ui-btn';
    dismissButton.textContent = 'Got it';
    dismissButton.addEventListener('click', () => this.dismiss());

    actions.append(dismissButton);

    this.statusElement = document.createElement('div');
    this.statusElement.className = 'panel-footer';

    this.element.append(header, steps, actions, this.statusElement);
  }

  show(): void {
    this.element.style.display = this.dismissed ? 'none' : '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    if (this.dismissed) {
      return;
    }
    this.statusElement.textContent = state.connected
      ? 'Tip: press M to cycle Cinematic/Story/Debug.'
      : 'Waiting for simulation server...';
  }

  destroy(): void {
    this.element.remove();
  }

  private dismiss(): void {
    this.dismissed = true;
    this.element.style.display = 'none';
    persistDismissedState();
  }
}

function loadDismissedState(): boolean {
  const storage = resolveStorage();
  if (!storage) {
    return false;
  }

  try {
    return storage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismissedState(): void {
  const storage = resolveStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    // Best effort only.
  }
}

function resolveStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage ?? null;
}
