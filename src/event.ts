export class EventSource<T> {
  private listeners: ((event: T) => void)[];

  addListener(callback: (event: T) => void) {
    this.listeners = [...this.listeners || [], callback];
  }

  fireEvent(event: T) {
    for (let listener of this.listeners || [])
      setTimeout(() => listener(event), 0);
  }
};
