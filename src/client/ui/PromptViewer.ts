import { UIPanel, UISimulationState } from './types';

interface PromptViewerOptions {
  getSelectedAgentId: () => string | null;
}

export class PromptViewer implements UIPanel {
  readonly id = 'prompt-viewer';
  readonly element: HTMLElement;

  private readonly promptElement: HTMLElement;
  private readonly responseElement: HTMLElement;
  private readonly getSelectedAgentId: () => string | null;

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

    this.promptElement = document.createElement('pre');
    this.promptElement.className = 'prompt-content';

    const responseHeader = document.createElement('div');
    responseHeader.className = 'panel-subheader';
    responseHeader.textContent = 'Last Response';

    this.responseElement = document.createElement('pre');
    this.responseElement.className = 'prompt-content';

    this.element.append(header, promptHeader, this.promptElement, responseHeader, this.responseElement);
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
      this.promptElement.textContent = 'Select an agent to inspect prompts.';
      this.responseElement.textContent = '';
      return;
    }

    const selectedAgent = state.agents.find((agent) => agent.id === selectedAgentId);
    if (!selectedAgent) {
      this.promptElement.textContent = `No data for ${selectedAgentId}`;
      this.responseElement.textContent = '';
      return;
    }

    this.promptElement.textContent = selectedAgent.llmTrace?.lastPrompt ?? 'No prompt yet for this agent.';
    this.responseElement.textContent = selectedAgent.llmTrace?.lastResponse ?? 'No response yet for this agent.';
  }

  destroy(): void {
    this.element.remove();
  }
}
