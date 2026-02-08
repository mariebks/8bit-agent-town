import { ControlEvent } from '@shared/Events';
import { TimeControlsStatus } from './TimeControlsStatus';
import { UIPanel, UISimulationState } from './types';

interface TimeControlsOptions {
  onControl: (action: ControlEvent['action'], value?: number) => void;
  onToggleFollowSelected?: () => boolean;
  onJumpToInteresting?: () => string | null;
  onToggleAutoDirector?: () => boolean;
  onToggleAudio?: () => boolean | Promise<boolean>;
  onToggleHeatmap?: () => boolean;
  onToggleFocusUi?: () => boolean;
  onToggleSelectedOnlySpeech?: () => boolean;
  onAddBookmark?: () => string | null;
  onJumpToBookmark?: () => string | null;
  getFollowSelectedEnabled?: () => boolean;
  getAutoDirectorEnabled?: () => boolean;
  getAudioEnabled?: () => boolean;
  getHeatmapVisible?: () => boolean;
  getFocusUiEnabled?: () => boolean;
  getSelectedOnlySpeechEnabled?: () => boolean;
}

export class TimeControls implements UIPanel {
  readonly id = 'time-controls';
  readonly element: HTMLElement;

  private readonly statusElement: HTMLElement;
  private readonly followButton: HTMLButtonElement | null;
  private readonly jumpButton: HTMLButtonElement | null;
  private readonly directorButton: HTMLButtonElement | null;
  private readonly audioButton: HTMLButtonElement | null;
  private readonly heatmapButton: HTMLButtonElement | null;
  private readonly focusUiButton: HTMLButtonElement | null;
  private readonly selectedOnlySpeechButton: HTMLButtonElement | null;
  private readonly options: TimeControlsOptions;
  private readonly status = new TimeControlsStatus();

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
      this.jumpButton = this.createButton('Next Event Agent (J)', () => {
        const jumped = options.onJumpToInteresting?.();
        if (jumped) {
          this.status.setTransient(`focused ${jumped}`);
          return;
        }
        this.status.setTransient('no interesting agents yet');
      });
      focusRow.append(this.jumpButton);
    } else {
      this.jumpButton = null;
    }

    if (options.onToggleAutoDirector) {
      this.directorButton = this.createButton('Director: On', () => {
        const enabled = options.onToggleAutoDirector?.() ?? false;
        this.updateDirectorLabel(enabled);
      });
      focusRow.append(this.directorButton);
    } else {
      this.directorButton = null;
    }

    if (options.onToggleAudio) {
      this.audioButton = this.createButton('Audio: Off', () => {
        const result = options.onToggleAudio?.();
        Promise.resolve(result)
          .then((enabled) => {
            this.updateAudioLabel(Boolean(enabled));
          })
          .catch(() => {
            this.updateAudioLabel(false);
          });
      });
      focusRow.append(this.audioButton);
    } else {
      this.audioButton = null;
    }

    if (options.onToggleHeatmap) {
      this.heatmapButton = this.createButton('Heatmap: Off', () => {
        const visible = options.onToggleHeatmap?.() ?? false;
        this.updateHeatmapLabel(visible);
      });
      focusRow.append(this.heatmapButton);
    } else {
      this.heatmapButton = null;
    }

    if (options.onToggleFocusUi) {
      this.focusUiButton = this.createButton('Focus UI: Off', () => {
        const enabled = options.onToggleFocusUi?.() ?? false;
        this.updateFocusUiLabel(enabled);
      });
      focusRow.append(this.focusUiButton);
    } else {
      this.focusUiButton = null;
    }

    if (options.onToggleSelectedOnlySpeech) {
      this.selectedOnlySpeechButton = this.createButton('Selected Speech: Off', () => {
        const enabled = options.onToggleSelectedOnlySpeech?.() ?? false;
        this.updateSelectedOnlySpeechLabel(enabled);
      });
      focusRow.append(this.selectedOnlySpeechButton);
    } else {
      this.selectedOnlySpeechButton = null;
    }

    if (options.onAddBookmark) {
      const bookmarkButton = this.createButton('Bookmark Agent', () => {
        const bookmarked = options.onAddBookmark?.();
        this.status.setTransient(bookmarked ? `bookmarked ${bookmarked}` : 'select an agent to bookmark');
      });
      focusRow.append(bookmarkButton);
    }

    if (options.onJumpToBookmark) {
      const jumpBookmarkButton = this.createButton('Next Bookmark', () => {
        const focused = options.onJumpToBookmark?.();
        this.status.setTransient(focused ? `focused bookmark ${focused}` : 'no bookmarks available');
      });
      focusRow.append(jumpBookmarkButton);
    }

    this.statusElement = document.createElement('div');
    this.statusElement.className = 'panel-footer';

    this.element.append(header, buttonRow, speedRow, focusRow, this.statusElement);
    this.updateFollowLabel(options.getFollowSelectedEnabled?.() ?? false);
    this.updateDirectorLabel(options.getAutoDirectorEnabled?.() ?? true);
    this.updateAudioLabel(options.getAudioEnabled?.() ?? false);
    this.updateHeatmapLabel(options.getHeatmapVisible?.() ?? false);
    this.updateFocusUiLabel(options.getFocusUiEnabled?.() ?? false);
    this.updateSelectedOnlySpeechLabel(options.getSelectedOnlySpeechEnabled?.() ?? false);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    this.updateFollowLabel(this.options.getFollowSelectedEnabled?.() ?? false);
    this.updateDirectorLabel(this.options.getAutoDirectorEnabled?.() ?? true);
    this.updateAudioLabel(this.options.getAudioEnabled?.() ?? false);
    this.updateHeatmapLabel(this.options.getHeatmapVisible?.() ?? false);
    this.updateFocusUiLabel(this.options.getFocusUiEnabled?.() ?? false);
    this.updateSelectedOnlySpeechLabel(this.options.getSelectedOnlySpeechEnabled?.() ?? false);
    const time = state.gameTime
      ? `Day ${state.gameTime.day} ${String(state.gameTime.hour).padStart(2, '0')}:${String(state.gameTime.minute).padStart(2, '0')}`
      : 'No server time';

    const baseStatus = `${time} | tick ${state.tickId} | ${state.connected ? 'online' : 'offline'}`;
    this.statusElement.textContent = this.status.resolve(baseStatus);
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

  private updateDirectorLabel(enabled: boolean): void {
    if (!this.directorButton) {
      return;
    }
    this.directorButton.textContent = `Director: ${enabled ? 'On' : 'Off'}`;
  }

  private updateAudioLabel(enabled: boolean): void {
    if (!this.audioButton) {
      return;
    }
    this.audioButton.textContent = `Audio: ${enabled ? 'On' : 'Off'}`;
  }

  private updateHeatmapLabel(visible: boolean): void {
    if (!this.heatmapButton) {
      return;
    }
    this.heatmapButton.textContent = `Heatmap: ${visible ? 'On' : 'Off'}`;
  }

  private updateFocusUiLabel(enabled: boolean): void {
    if (!this.focusUiButton) {
      return;
    }
    this.focusUiButton.textContent = `Focus UI (Shift+F): ${enabled ? 'On' : 'Off'}`;
  }

  private updateSelectedOnlySpeechLabel(enabled: boolean): void {
    if (!this.selectedOnlySpeechButton) {
      return;
    }
    this.selectedOnlySpeechButton.textContent = `Selected Speech: ${enabled ? 'On' : 'Off'}`;
  }
}
