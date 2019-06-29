// Selects dark or light mode.

import { gConfig } from 'src/config';
import { log } from 'src/log';

const SEL_LINK = '#dm-style';
const SEL_BUTTON = '#dmode-url > u';

const TEXT_WHEN_DARK = 'Light Mode';
const TEXT_WHEN_LIGHT = 'Dark Mode';

const CSS_DARK = 'styles/dark.css';
const CSS_LIGHT = 'styles/light.css';

export function init() {
  try {
    updateUI();
    let button: HTMLElement = document.querySelector(SEL_BUTTON);
    button.addEventListener('click', switchMode);
  } catch (err) {
    log.w('Failed to select dark/light mode:', err);
  }
}

function switchMode() {
  try {
    log.i('Switching dark mode.');
    let usedm = !!gConfig.dmode.get();
    gConfig.dmode.set(!usedm);
    updateUI();
  } catch (err) {
    log.w('Failed to switch dark/light mode:', err);
  }
}

function updateUI() {
  let link = document.querySelector(SEL_LINK);
  let button: HTMLElement = document.querySelector(SEL_BUTTON);
  let usedm = !!gConfig.dmode.get();
  log.i('Dark mode?', usedm);
  let url = usedm ? CSS_DARK : CSS_LIGHT;
  let text = usedm ? TEXT_WHEN_DARK : TEXT_WHEN_LIGHT;
  link.setAttribute('href', url);
  log.i('Selected mode:', url);
  button.textContent = text;
}
