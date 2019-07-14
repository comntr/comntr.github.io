define(["require", "exports", "src/log", "src/config", "./svg"], function (require, exports, log_1, config_1, svg_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const log = log_1.tagged('stats');
    async function init() {
        log.i('Started');
        try {
            let srv = config_1.gConfig.srv.get();
            log.i('Data server:', srv);
            document.title += ' - ' + srv;
            let prefix = location.hash.slice(1) || '';
            let baseUrl = srv + '/stats/' + prefix;
            let rsp = await fetch(baseUrl);
            let json = await rsp.json();
            let statNames = Object.keys(json).sort();
            for (let statName of statNames) {
                log.i('Working on stat', statName);
                let div = document.createElement('div');
                document.body.appendChild(div);
                div.className = 'stat';
                let [stime, nreqs] = json[statName];
                let svg = svg_1.makeSvg(stime, nreqs);
                div.innerHTML += `
        <a href="${srv + '/stats/' + statName}">
          ${statName}</a>`;
                div.innerHTML += svg;
            }
        }
        catch (err) {
            log.e('Failed:', err);
        }
    }
    exports.init = init;
});
//# sourceMappingURL=index.js.map