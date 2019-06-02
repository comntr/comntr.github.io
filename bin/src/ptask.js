define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class PeriodicTask {
        constructor(args) {
            this.args = args;
            this.timer = 0;
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
    }
    exports.PeriodicTask = PeriodicTask;
    ;
});
//# sourceMappingURL=ptask.js.map