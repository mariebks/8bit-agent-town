export type UIEventType = 'agent:selected' | 'state:updated' | 'log:new' | 'debug:toggle' | 'ui:modeChanged';

type Listener<T = unknown> = (payload: T) => void;

export class UIEventBus {
  private readonly listeners = new Map<UIEventType, Set<Listener>>();

  on<T>(event: UIEventType, callback: Listener<T>): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(callback as Listener);
    this.listeners.set(event, set);

    return () => {
      set.delete(callback as Listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<T>(event: UIEventType, payload: T): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }

    for (const callback of set) {
      callback(payload);
    }
  }
}
