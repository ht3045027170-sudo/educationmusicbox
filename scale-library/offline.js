(() => {
  'use strict';
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/scale-offline-worker.js').catch(() => {});
    }, {once:true});
  }
})();
