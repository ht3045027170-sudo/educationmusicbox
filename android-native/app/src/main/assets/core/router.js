(() => {
  'use strict';
  const routes = new Map();
  let fallback = null;
  function register(id, lifecycle = {}) { routes.set(id, lifecycle); }
  function setFallback(handler) { fallback = handler; }
  function current() { return window.HetianCore?.state?.get('app.route') || ''; }
  function go(id, meta = {}) {
    const from = current();
    if (!id || id === from) return id;
    window.HetianCore?.audio?.stopAll?.('route-change');
    try { routes.get(from)?.leave?.({ from, to: id, meta }); } catch (error) { window.HetianCore?.state?.recordError(`router.leave.${from}`, error); }
    window.HetianCore?.events?.dispose(`route:${from}`);
    fallback?.(id, { from, meta });
    window.HetianCore?.state?.set('app.route', id, { source: meta.source || 'router' });
    try { routes.get(id)?.enter?.({ from, to: id, meta }); } catch (error) { window.HetianCore?.state?.recordError(`router.enter.${id}`, error); }
    window.dispatchEvent(new CustomEvent('hetian:route-change', { detail: { from, to: id, meta } }));
    return id;
  }
  window.HetianCore = window.HetianCore || {};
  window.HetianCore.router = { register, setFallback, current, go };
})();
