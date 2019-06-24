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
        act: qprop('act', 0.0),
        srv: qprop('srv', 'https://comntr.live:42751'),
        // interval in seconds between resending comments
        cri: qprop('cri', 600),
        // drafts update timeout in seconds
        dut: qprop('dut', 1),
        // signs all comments before sending
        sign: qprop('sign', true),
    };
});
//# sourceMappingURL=config.js.map