// Selects dark or light mode.
define(["require", "exports", "src/config", "src/log"], function (require, exports, config_1, log_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const SEL_LINK = '#dm-style';
    const SEL_BUTTON = '#dmode-url > u';
    const TEXT_WHEN_DARK = 'Light';
    const TEXT_WHEN_LIGHT = 'Dark';
    const CSS_DARK = 'styles/dark.css';
    const CSS_LIGHT = 'styles/light.css';
    function init() {
        try {
            updateUI();
            let button = document.querySelector(SEL_BUTTON);
            button.addEventListener('click', switchMode);
        }
        catch (err) {
            log_1.log.w('Failed to select dark/light mode:', err);
        }
    }
    exports.init = init;
    function switchMode() {
        try {
            log_1.log.i('Switching dark mode.');
            let usedm = !!config_1.gConfig.dmode.get();
            config_1.gConfig.dmode.set(!usedm);
            updateUI();
        }
        catch (err) {
            log_1.log.w('Failed to switch dark/light mode:', err);
        }
    }
    function updateUI() {
        let link = document.querySelector(SEL_LINK);
        let button = document.querySelector(SEL_BUTTON);
        let usedm = !!config_1.gConfig.dmode.get();
        log_1.log.i('Dark mode?', usedm);
        let url = usedm ? CSS_DARK : CSS_LIGHT;
        let text = usedm ? TEXT_WHEN_DARK : TEXT_WHEN_LIGHT;
        link.setAttribute('href', url);
        log_1.log.i('Selected mode:', url);
        button.textContent = text;
    }
});
//# sourceMappingURL=dmode.js.map