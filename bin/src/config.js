define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function getQueryParams(defaults) {
        let dict = Object.assign({}, defaults);
        let args = location.search.slice(1).split('&');
        for (let arg of args) {
            let i = arg.indexOf('=');
            if (i < 0)
                i = arg.length;
            let name = decodeURIComponent(arg.slice(0, i));
            let value = decodeURIComponent(arg.slice(i + 1));
            try {
                dict[name] = JSON.parse(value);
            }
            catch (err) {
                dict[name] = value;
            }
        }
        return dict;
    }
    function getQueryParam(name) {
        return exports.gConfig[name];
    }
    exports.getQueryParam = getQueryParam;
    exports.gConfig = getQueryParams({
        ext: false,
        act: 0.0,
        srv: 'https://comntr.live:42751',
        cri: 600,
    });
});
//# sourceMappingURL=config.js.map