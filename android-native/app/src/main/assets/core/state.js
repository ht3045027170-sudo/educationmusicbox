(() => {
  'use strict';

  const clone = value => value === undefined ? undefined
    : (window.structuredClone ? window.structuredClone(value) : JSON.parse(JSON.stringify(value)));
  const split = path => Array.isArray(path) ? path : String(path || '').split('.').filter(Boolean);
  const subscribers = new Set();
  const state = {
    app: { route: 'menu', visibility: document.visibilityState || 'visible' },
    audio: { outputOwner: '', inputOwner: '', contextState: 'idle' },
    diagnostics: { recentErrors: [] }
  };

  function get(path = '') {
    return split(path).reduce((value, key) => value?.[key], state);
  }

  function set(path, value, meta = {}) {
    const keys = split(path);
    if (!keys.length) throw new Error('State path is required');
    let target = state;
    keys.slice(0, -1).forEach(key => { target[key] ||= {}; target = target[key]; });
    target[keys.at(-1)] = clone(value);
    const event = { path: keys.join('.'), value: clone(value), meta, state: clone(state) };
    subscribers.forEach(listener => { try { listener(event); } catch (error) { console.error(error); } });
    window.dispatchEvent(new CustomEvent('hetian:state', { detail: event }));
    return clone(value);
  }

  function patch(path, partial, meta = {}) {
    return set(path, { ...(get(path) || {}), ...(partial || {}) }, meta);
  }

  function subscribe(path, listener) {
    const expected = String(path || '');
    const wrapped = event => {
      if (!expected || event.path === expected || event.path.startsWith(`${expected}.`)) listener(event);
    };
    subscribers.add(wrapped);
    return () => subscribers.delete(wrapped);
  }

  function recordError(source, error) {
    const message = String(error?.message || error || 'Unknown error');
    const recent = [...(get('diagnostics.recentErrors') || []), { source, message, at: Date.now() }].slice(-80);
    set('diagnostics.recentErrors', recent, { source: 'diagnostics' });
  }

  document.addEventListener('visibilitychange', () => set('app.visibility', document.visibilityState, { source: 'browser' }));
  window.HetianCore = window.HetianCore || {};
  window.HetianCore.state = { get, set, patch, subscribe, recordError, snapshot: () => clone(state) };
})();
