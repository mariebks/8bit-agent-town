import { UIPanel, UISimulationState } from './types';

interface PromptViewerOptions {
  getSelectedAgentId: () => string | null;
}

export class PromptViewer implements UIPanel {
  readonly id = 'prompt-viewer';
  readonly element: HTMLElement;

  private readonly promptElement: HTMLElement;
  private readonly responseElement: HTMLElement;
  private readonly statusElement: HTMLElement;
  private readonly getSelectedAgentId: () => string | null;
  private currentPromptText = '';
  private currentResponseText = '';

  constructor(options: PromptViewerOptions) {
    this.getSelectedAgentId = options.getSelectedAgentId;

    this.element = document.createElement('section');
    this.element.className = 'ui-panel prompt-viewer';

    const header = document.createElement('header');
    header.className = 'panel-header';
    header.textContent = 'Prompt/Response';

    const promptHeader = document.createElement('div');
    promptHeader.className = 'panel-subheader';
    promptHeader.textContent = 'Last Prompt';

    const copyRow = document.createElement('div');
    copyRow.className = 'time-controls-row';

    const copyPromptButton = document.createElement('button');
    copyPromptButton.type = 'button';
    copyPromptButton.className = 'ui-btn ui-btn-ghost';
    copyPromptButton.textContent = 'Copy Prompt';
    copyPromptButton.addEventListener('click', () => {
      void this.copyPrompt();
    });

    const copyResponseButton = document.createElement('button');
    copyResponseButton.type = 'button';
    copyResponseButton.className = 'ui-btn ui-btn-ghost';
    copyResponseButton.textContent = 'Copy Response';
    copyResponseButton.addEventListener('click', () => {
      void this.copyResponse();
    });

    copyRow.append(copyPromptButton, copyResponseButton);

    this.promptElement = document.createElement('pre');
    this.promptElement.className = 'prompt-content';

    const responseHeader = document.createElement('div');
    responseHeader.className = 'panel-subheader';
    responseHeader.textContent = 'Last Response';

    this.responseElement = document.createElement('pre');
    this.responseElement.className = 'prompt-content';

    this.statusElement = document.createElement('div');
    this.statusElement.className = 'panel-footer';

    this.element.append(header, copyRow, promptHeader, this.promptElement, responseHeader, this.responseElement, this.statusElement);
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  update(state: UISimulationState): void {
    const selectedAgentId = this.getSelectedAgentId();
    if (!selectedAgentId) {
      this.currentPromptText = 'Select an agent to inspect prompts.';
      this.currentResponseText = '';
      this.promptElement.textContent = this.currentPromptText;
      this.responseElement.textContent = this.currentResponseText;
      return;
    }

    const selectedAgent = state.agents.find((agent) => agent.id === selectedAgentId);
    if (!selectedAgent) {
      this.currentPromptText = `No data for ${selectedAgentId}`;
      this.currentResponseText = '';
      this.promptElement.textContent = this.currentPromptText;
      this.responseElement.textContent = this.currentResponseText;
      return;
    }

    this.currentPromptText = selectedAgent.llmTrace?.lastPrompt ?? 'No prompt yet for this agent.';
    this.currentResponseText = selectedAgent.llmTrace?.lastResponse ?? 'No response yet for this agent.';
    this.promptElement.textContent = this.currentPromptText;
    this.responseElement.textContent = this.currentResponseText;
  }

  destroy(): void {
    this.element.remove();
  }

  private async copyPrompt(): Promise<void> {
    const copied = await copyTextToClipboard(this.currentPromptText);
    this.statusElement.textContent = copied ? 'Prompt copied.' : 'Prompt copy failed.';
  }

  private async copyResponse(): Promise<void> {
    const copied = await copyTextToClipboard(this.currentResponseText);
    this.statusElement.textContent = copied ? 'Response copied.' : 'Response copy failed.';
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (text.length === 0) {
    return false;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy copy path.
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    textarea.remove();
  }

  return copied;
}
