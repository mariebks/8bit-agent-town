import { UIPanel, UISimulationState } from './types';
import { UiDensity } from './UiDensity';

const ONBOARDING_STORAGE_KEY = 'agent-town.ui.onboarding.dismissed';
const ONBOARDING_PROGRESS_STORAGE_KEY = 'agent-town.ui.onboarding.progress';

export interface OnboardingProgress {
  selectedAgent: boolean;
  followEnabled: boolean;
  jumpedToEvent: boolean;
}

interface OnboardingPanelOptions {
  getProgress?: () => OnboardingProgress;
  onResetProgress?: () => void;
  getDensity?: () => UiDensity;
  onToggleDensity?: () => UiDensity;
}

export class OnboardingPanel implements UIPanel {
  readonly id = 'onboarding-panel';
  readonly element: HTMLElement;

  private readonly statusElement: HTMLElement;
  private readonly stepItems: Array<{ key: keyof OnboardingProgress; item: HTMLLIElement; label: string }>;
  private readonly options: OnboardingPanelOptions;
  private dismissed = loadDismissedState();
  private progress = loadProgressState();

  constructor(options: OnboardingPanelOptions = {}) {
    this.options = options;
    this.element = document.createElement('section');
    this.element.className = 'ui-panel onboarding-panel';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Welcome to Agent Town';

    const steps = document.createElement('ol');
    steps.className = 'onboarding-steps';
    this.stepItems = [];
    const stepDefinitions: Array<{ key: keyof OnboardingProgress; label: string }> = [
      { key: 'selectedAgent', label: 'Click an agent to inspect story and state.' },
      { key: 'followEnabled', label: 'Turn Follow on to stay with that agent.' },
      { key: 'jumpedToEvent', label: 'Use Next Event Agent to jump to a new moment.' },
    ];
    for (const definition of stepDefinitions) {
      const item = document.createElement('li');
      item.textContent = definition.label;
      this.stepItems.push({
        key: definition.key,
        item,
        label: definition.label,
      });
      steps.appendChild(item);
    }

    const actions = document.createElement('div');
    actions.className = 'time-controls-row';

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'ui-btn';
    dismissButton.textContent = 'Hide Guide';
    dismissButton.addEventListener('click', () => this.dismiss());

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'ui-btn ui-btn-ghost';
    resetButton.textContent = 'Reset Steps';
    resetButton.addEventListener('click', () => this.resetProgress());

    actions.append(dismissButton, resetButton);

    if (options.onToggleDensity) {
      const densityButton = document.createElement('button');
      densityButton.type = 'button';
      densityButton.className = 'ui-btn ui-btn-ghost';
      densityButton.textContent = options.getDensity?.() === 'compact' ? 'Use Full UI' : 'Use Compact UI';
      densityButton.addEventListener('click', () => {
        const nextDensity = options.onToggleDensity?.();
        densityButton.textContent = nextDensity === 'compact' ? 'Use Full UI' : 'Use Compact UI';
      });
      actions.append(densityButton);
    }

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

    const liveProgress = this.options.getProgress?.() ?? {
      selectedAgent: Boolean(state.manualSelectionMade),
      followEnabled: Boolean(state.followSelected),
      jumpedToEvent: Boolean(state.lastJumpedAgentId),
    };
    this.progress = {
      selectedAgent: this.progress.selectedAgent || liveProgress.selectedAgent,
      followEnabled: this.progress.followEnabled || liveProgress.followEnabled,
      jumpedToEvent: this.progress.jumpedToEvent || liveProgress.jumpedToEvent,
    };
    persistProgressState(this.progress);
    this.renderProgress();

    if (this.progress.selectedAgent && this.progress.followEnabled && this.progress.jumpedToEvent) {
      this.dismiss();
      return;
    }

    this.statusElement.textContent = state.connected
      ? `Complete all 3 steps to auto-dismiss this guide. Tip: ${
          this.options.getDensity?.() === 'compact'
            ? 'switch to Full UI in View Mode if you want more detail.'
            : 'switch to Compact UI in View Mode if overlays feel crowded.'
        }`
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

  private renderProgress(): void {
    for (const step of this.stepItems) {
      const done = this.progress[step.key];
      step.item.classList.toggle('onboarding-step-done', done);
      step.item.textContent = done ? `Done: ${step.label}` : step.label;
    }
  }

  private resetProgress(): void {
    this.dismissed = false;
    this.progress = {
      selectedAgent: false,
      followEnabled: false,
      jumpedToEvent: false,
    };
    persistProgressState(this.progress);
    this.options.onResetProgress?.();
    this.element.style.display = '';
    this.renderProgress();
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

function loadProgressState(): OnboardingProgress {
  const storage = resolveStorage();
  if (!storage) {
    return {
      selectedAgent: false,
      followEnabled: false,
      jumpedToEvent: false,
    };
  }

  try {
    const raw = storage.getItem(ONBOARDING_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return {
        selectedAgent: false,
        followEnabled: false,
        jumpedToEvent: false,
      };
    }
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    return {
      selectedAgent: Boolean(parsed.selectedAgent),
      followEnabled: Boolean(parsed.followEnabled),
      jumpedToEvent: Boolean(parsed.jumpedToEvent),
    };
  } catch {
    return {
      selectedAgent: false,
      followEnabled: false,
      jumpedToEvent: false,
    };
  }
}

function persistProgressState(progress: OnboardingProgress): void {
  const storage = resolveStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(ONBOARDING_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
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
