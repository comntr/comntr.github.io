define(["require", "exports", "src/config"], function (require, exports, config_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const GRID_W = 1e3;
    const GRID_H = 1e3;
    const GRID_LABEL_W = 100;
    const GRID_LABEL_H = 100;
    const GRID_FONT_SIZE = 50;
    const GRID_LINE_COLOR = '#00f4';
    const GRID_LINE_WIDTH = 1;
    const GRID_LABEL_DIGITS = 3;
    const PATH_LINE_WIDTH = 1;
    function makeSvg(stime, nreqs) {
        let nsize = nreqs.length;
        let qpsavg = new Array(nsize);
        for (let dt = 0; dt < nsize; dt++) {
            let i = (stime + 1 + dt) % nsize;
            qpsavg[dt] = nreqs[i];
        }
        let qpsmax = Math.max(...qpsavg);
        let w = nsize;
        let h = Math.max(1, 10 ** Math.ceil(Math.log10(qpsmax)));
        let mpath = qpsavg
            .map((q, t) => `L ${t / w * GRID_W | 0} ${(1 - q / h) * GRID_H | 0}`)
            .join(' ')
            .replace(/^L/, 'M');
        let hlines = makeHorLines({
            ymin: 0,
            ymax: h,
            ystep: h * config_1.gConfig.dqps.get(),
            label: glabel,
            xmin: 0,
            xmax: GRID_W,
        });
        let vlines = makeVerLines({
            xmin: -stime / 60 % 6,
            xmax: w,
            xstep: 6 * 60,
            label: dm => new Date((stime - 3600 + dm * 60) * 1000)
                .toTimeString().slice(0, 5),
            ymin: 0,
            ymax: GRID_H,
        });
        return `
    <svg viewBox="-${GRID_LABEL_W} 0 ${GRID_W + GRID_LABEL_W} ${GRID_H + GRID_LABEL_H}"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg">

      <style>
        text {
          font-size: ${GRID_FONT_SIZE}px;
        }
        path {
          fill: none;
          vector-effect: non-scaling-stroke;
        }
      </style>

      <!-- lines -->
      <g stroke-dasharray="3,3"
        stroke="${GRID_LINE_COLOR}" 
        stroke-width="${GRID_LINE_WIDTH}">
        ${hlines.join('\n')}
        ${vlines.join('\n')}
      </g>

      <!-- graph -->
      <g>
        <path
          stroke="black" stroke-width="${PATH_LINE_WIDTH}"
          d="${mpath}"/>
      </g>
    </svg>`;
    }
    exports.makeSvg = makeSvg;
    function makeHorLines({ ymin, ymax, ystep, xmin, xmax, label }) {
        let hlines = [];
        for (let y = ymin; y <= ymax; y += ystep) {
            let yc = ((1 - y / (ymax - ymin)) * GRID_H) | 0;
            let tyc = (+yc + GRID_FONT_SIZE / 3) | 0;
            if (yc <= 0 || yc >= GRID_H)
                continue;
            hlines.push(`
      <text x="-${GRID_LABEL_W}" y="${tyc}">${label(y)}</text>`);
            hlines.push(`
      <path  d="M ${xmin} ${yc} L ${xmax} ${yc}"/>`);
        }
        return hlines;
    }
    function makeVerLines({ ymin, ymax, xstep, xmin, xmax, label }) {
        let vlines = [];
        for (let x = xmin; x <= xmax; x += xstep) {
            let xc = (x / (xmax - xmin) * GRID_W) | 0;
            let txc = (+xc - GRID_FONT_SIZE) | 0;
            if (xc <= 0 || xc >= GRID_W)
                continue;
            vlines.push(`
      <text x="${txc}" y="${GRID_H + GRID_LABEL_H}">${label(x)}</text>`);
            vlines.push(`
      <path d="M ${xc} ${ymin} L ${xc} ${ymax}"/>`);
        }
        return vlines;
    }
    function glabel(value) {
        let str = value.toFixed(GRID_LABEL_DIGITS)
            .replace(/\.0+$/, '');
        let i = str.indexOf('.');
        if (i > 0)
            str = str.slice(0, -i);
        return str;
    }
});
//# sourceMappingURL=svg.js.map