(function () {
    'use strict';
    chrome.storage.local.get(['customFunctions', 'sharedJS', 'sharedGLSL'], (data) => {
        const funcs = data.customFunctions || [];
        const sharedJS = data.sharedJS || '';
        const sharedGLSL = data.sharedGLSL || '';
        window.postMessage({ type: 'DCG_FUNCTIONS_LOADED', funcs, sharedJS, sharedGLSL }, '*');
    });
})();
