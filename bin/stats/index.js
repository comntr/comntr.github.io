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
            let divs = document.querySelectorAll('.stat');
            for (let i = 0; i < divs.length; i++) {
                let div = divs[i];
                let stat = div.getAttribute('stat');
                let url = srv + '/stats/qps/' + stat;
                log.i('Working on stat', stat);
                let rsp = await fetch(url);
                let [stime, nreqs] = await rsp.json();
                let qpsmax = Math.max(...nreqs);
                let svg = svg_1.makeSvg(stime, nreqs);
                div.innerHTML += `
        <a href="${url}">
          ${div.getAttribute('title')}; max qps = ${qpsmax}
        </a>`;
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