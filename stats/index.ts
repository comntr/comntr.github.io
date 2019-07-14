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
      let svg = makeSvg(stime, nreqs);
      div.innerHTML += `
        <a href="${srv + '/stats/' + statName}">${statName}</a>
        <div>min: ${Math.min(...nreqs)}; max: ${Math.max(...nreqs)}</div>
        `;
      div.innerHTML += svg;
    }
  } catch (err) {
    log.e('Failed:', err);
  }
}
