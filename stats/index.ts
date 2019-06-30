import { tagged } from 'src/log';
import { gConfig } from 'src/config';
import { makeSvg } from './svg';

const log = tagged('stats');

export async function init() {
  log.i('Started');
  try {
    let srv = gConfig.srv.get();
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
      let svg = makeSvg(stime, nreqs);
      div.innerHTML += `
        <a href="${url}">
          ${div.getAttribute('title')}; max qps = ${qpsmax}
        </a>`;
      div.innerHTML += svg;
    }
  } catch (err) {
    log.e('Failed:', err);
  }
}
