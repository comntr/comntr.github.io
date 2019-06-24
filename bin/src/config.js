define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    let gQueryParams = null;
    function getQueryParams() {
        if (gQueryParams)
            return gQueryParams;
        let dict = {};
        let args = location.search.slice(1).split('&');
        for (let arg of args) {
            let i = arg.indexOf('=');
            if (i < 0)
                i = arg.length;
            let name = decodeURIComponent(arg.slice(0, i));
            let value = decodeURIComponent(arg.slice(i + 1));
            dict[name] = value;
        }
        return gQueryParams = dict;
    }
    // Reads a JSON property from the URL ?<...> query.
    function qprop(name, defval) {
        return {
            get() {
                let qp = getQueryParams();
                let str = qp[name];
                if (!str)
                    return defval;
                try {
                    return JSON.parse(str);
                }
                catch (err) {
                    return str;
                }
            }
        };
    }
    // Reads a JSON property from localStorage.
    function lsprop(name, defval) {
        return {
            get() {
                let str = localStorage.getItem(name);
                if (!str) {
                    if (defval !== undefined) {
                        let json = typeof defval === 'string' ?
                            defval : JSON.stringify(defval);
                        localStorage.setItem(name, json);
                    }
                    return defval;
                }
                try {
                    return JSON.parse(str);
                }
                catch (err) {
                    return str;
                }
            }
        };
    }
    // Returns the first non-undefined value.
    function msprop(props, defval) {
        return {
            get() {
                for (let prop of props) {
                    let val = prop.get();
                    if (val !== undefined)
                        return val;
                }
                return defval;
            }
        };
    }
    exports.gConfig = {
        ext: qprop('ext', false),
        // add-comment throttling: 0.99 would throttle 99% of attempts
        act: msprop([
            qprop('act'),
            lsprop('debug.send.throttling', 0.0),
        ]),
        srv: msprop([
            qprop('srv'),
            lsprop('user.remote.url', 'https://comntr.live:42751'),
        ]),
        // interval in seconds between resending comments
        cri: msprop([
            qprop('cri'),
            lsprop('user.send.retry', 600),
        ]),
        // drafts update timeout in seconds
        dut: msprop([
            qprop('dut'),
            lsprop('user.edit.timeout', 1),
        ]),
        // signs all comments before sending
        sign: msprop([
            qprop('sign'),
            lsprop('user.send.sign', true),
        ]),
    };
});
//# sourceMappingURL=config.js.map