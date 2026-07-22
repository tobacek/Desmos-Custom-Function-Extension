(function () {
    'use strict';
    chrome.storage.local.get(['customFunctions', 'sharedJS'], (data) => {
        const funcs = data.customFunctions || [];
        const sharedJS = data.sharedJS || '';
        window.postMessage({ type: 'DCG_FUNCTIONS_LOADED', funcs, sharedJS }, '*');
    });
})();
