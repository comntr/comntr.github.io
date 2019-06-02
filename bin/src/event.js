define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class EventSource {
        addListener(callback) {
            this.listeners = [...this.listeners || [], callback];
        }
        fireEvent(event) {
            for (let listener of this.listeners || [])
                setTimeout(() => listener(event), 0);
        }
    }
    exports.EventSource = EventSource;
    ;
});
//# sourceMappingURL=event.js.map