import { gConfig } from 'src/config';

const GRID_LINE_COLOR = '#00f4';
const GRID_LINE_WIDTH = 1;

export function makeSvg(stime: number, nreqs: number[]): string {
  let ctime = Date.now() / 1000 | 0;
  let nsize = nreqs.length;
  let qpsavg = [];

  for (let dt = 0; dt < nsize; dt++) {
    let i = (ctime + 1 + dt) % nsize;
    let j = dt / 60 | 0;
    qpsavg[j] = qpsavg[j] || 0;
    qpsavg[j] += nreqs[i] / 60;
  }

  let qpsavgmax = Math.max(...qpsavg);
  let mpath = qpsavg
    .map((q, t) => `L ${t} ${q.toFixed(2)}`)
    .join(' ')
    .replace(/^L/, 'M');

  let w = qpsavg.length;
  let h = Math.max(1, qpsavgmax);

  let hlines = makeHLines({
    ymin: 0,
    ymax: h,
    ystep: gConfig.dqps.get(),
    xmin: 0,
    xmax: w,
  });

  let vlines = makeVLines({
    xmin: (ctime / 60 | 0) % 15,
    xmax: w,
    xstep: 15,
    ymin: 0,
    ymax: h,
  });

  return `
    <svg viewBox="0 0 ${w} ${h}"
      preserveAspectRatio="none"
      transform="scale(1,-1)"
      xmlns="http://www.w3.org/2000/svg">

      ${hlines.join('\n')}
      ${vlines.join('\n')}

      <path fill="none"
        stroke="black" stroke-width="2"
        vector-effect="non-scaling-stroke"
        d="${mpath}"/>
    </svg>`;
}

function makeHLines({ ymin, ymax, ystep, xmin, xmax }) {
  let hlines = [];

  for (let y = ymin; y <= ymax; y += ystep) {
    hlines.push(`
      <path fill="none"
          stroke="${GRID_LINE_COLOR}" stroke-width="${GRID_LINE_WIDTH}"
          stroke-dasharray="3,3"
          vector-effect="non-scaling-stroke"
          d="M ${xmin} ${y} L ${xmax} ${y}"/>`);
  }

  return hlines;
}

function makeVLines({ ymin, ymax, xstep, xmin, xmax }) {
  let vlines = [];

  for (let x = xmin; x <= xmax; x += xstep) {
    vlines.push(`
      <path fill="none"
          stroke="${GRID_LINE_COLOR}" stroke-width="${GRID_LINE_WIDTH}"
          stroke-dasharray="3,3"
          vector-effect="non-scaling-stroke"
          d="M ${x} ${ymin} L ${x} ${ymax}"/>`);
  }

  return vlines;
}
