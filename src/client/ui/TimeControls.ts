import { ControlEvent } from '@shared/Events';
import { UIPanel, UISimulationState } from './types';

interface TimeControlsOptions {
  onControl: (action: ControlEvent['action'], value?: number) => void;
  onToggleFollowSelected?: () => boolean;
  onJumpToInteresting?: () => string | null;
  getFollowSelectedEnabled?: () => boolean;
}

export class TimeControls implements UIPanel {
  readonly id = 'time-controls';
  readonly element: HTMLElement;

  private readonly statusElement: HTMLElement;
  private readonly followButton: HTMLButtonElement | null;
  private readonly jumpButton: HTMLButtonElement | null;
  private readonly options: TimeControlsOptions;

  constructor(options: TimeControlsOptions) {
    this.options = options;
    this.element = document.createElement('section');
    this.element.className = 'ui-panel time-controls';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Time Controls';

    const buttonRow = document.createElement('div');
    buttonRow.className = 'time-controls-row';

    const pause = this.createButton('Pause', () => options.onControl('pause'));
    const resume = this.createButton('Resume', () => options.onControl('resume'));

    buttonRow.append(pause, resume);

    const speedRow = document.createElement('div');
    speedRow.className = 'time-controls-row';
    for (const speed of [1, 2, 4, 10]) {
      speedRow.append(this.createButton(`${speed}x`, () => options.onControl('setSpeed', speed)));
    }

    const focusRow = document.createElement('div');
    focusRow.className = 'time-controls-row';

    if (options.onToggleFollowSelected) {
      this.followButton = this.createButton('Follow: Off', () => {
        const enabled = options.onToggleFollowSelected?.() ?? false;
        this.updateFollowLabel(enabled);
      });
      focusRow.append(this.followButton);
    } else {
      this.followButton = null;
    }

    if (options.onJumpToInteresting) {
      this.jumpButton = this.createButton('Next Event Agent', () => {
        const jumped = options.onJumpToInteresting?.();
        if (jumped) {
          this.statusElement.textContent = `focused ${jumped}`;
          return;
        }
        this.statusElement.textContent = 'no interesting agents yet';
      });
      focusRow.append(this.jumpButton);
    } else {
      this.jumpButton = null;
    }

    this.statusElement = document.createElement('div');
    this.statusElement.className = 'panel-footer';

    this.element.append(header, buttonRow, speedRow, focusRow, this.statusElement);
    this.updateFollowLabel(options.getFollowSelectedEnabled?.() ?? false);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    this.updateFollowLabel(this.options.getFollowSelectedEnabled?.() ?? false);
    const time = state.gameTime
      ? `Day ${state.gameTime.day} ${String(state.gameTime.hour).padStart(2, '0')}:${String(state.gameTime.minute).padStart(2, '0')}`
      : 'No server time';

    this.statusElement.textContent = `${time} | tick ${state.tickId} | ${state.connected ? 'online' : 'offline'}`;
  }

  destroy(): void {
    this.element.remove();
  }

  private createButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ui-btn';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private updateFollowLabel(enabled: boolean): void {
    if (!this.followButton) {
      return;
    }
    this.followButton.textContent = `Follow: ${enabled ? 'On' : 'Off'}`;
  }
}
