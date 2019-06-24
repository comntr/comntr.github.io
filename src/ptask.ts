interface PeriodicTaskArgs {
  interval: number; // seconds
  randomness: number; // 0.0..1.0
  callback: () => void;
}

export class PeriodicTask {
  private timer = 0;

  constructor(private args: PeriodicTaskArgs) {

  }

  stop() {
    clearTimeout(this.timer);
    this.timer = 0;
  }

  start() {
    this.stop();
    this.schedule();
  }

  schedule() {
    let factor = 1 + this.args.randomness * (2 * Math.random() - 1);
    let delay = this.args.interval * factor;
    this.timer = setTimeout(() => {
      this.stop();
      this.schedule();
      this.args.callback.call(null);
    }, delay * 1000 | 0);
  }
};
