(() => {
  'use strict';

  const scopes = new Map();
  function scope(name) {
    const key = String(name || 'global');
    if (scopes.has(key)) return scopes.get(key);
    const cleanups = new Set();
    const api = {
      name: key,
      use(cleanup) { if (typeof cleanup === 'function') cleanups.add(cleanup); return cleanup; },
      on(target, type, listener, options) {
        target?.addEventListener?.(type, listener, options);
        return api.use(() => target?.removeEventListener?.(type, listener, options));
      },
      timeout(listener, delay) {
        const id = window.setTimeout(() => { cleanups.delete(cancel); listener(); }, delay);
        const cancel = () => window.clearTimeout(id);
        return api.use(cancel);
      },
      interval(listener, delay) { const id = window.setInterval(listener, delay); return api.use(() => window.clearInterval(id)); },
      raf(listener) {
        let id = 0;
        const tick = time => { id = window.requestAnimationFrame(tick); listener(time); };
        id = window.requestAnimationFrame(tick);
        return api.use(() => window.cancelAnimationFrame(id));
      },
      dispose() {
        [...cleanups].reverse().forEach(cleanup => { try { cleanup(); } catch (error) { console.error(error); } });
        cleanups.clear(); scopes.delete(key);
      }
    };
    scopes.set(key, api);
    return api;
  }
  function dispose(name) { scopes.get(String(name || 'global'))?.dispose(); }
  function disposePrefix(prefix) { [...scopes.keys()].filter(key => key.startsWith(prefix)).forEach(dispose); }
  window.HetianCore = window.HetianCore || {};
  window.HetianCore.events = { scope, dispose, disposePrefix, active: () => [...scopes.keys()] };
})();
