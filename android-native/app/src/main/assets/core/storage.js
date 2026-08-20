(() => {
  'use strict';
  const registry = new Map();
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function readRaw(key) {
    try { return localStorage.getItem(key); }
    catch (error) { window.HetianCore?.state?.recordError('storage.read', error); return null; }
  }
  function writeRaw(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (error) {
      window.HetianCore?.state?.recordError('storage.write', error);
      window.dispatchEvent(new CustomEvent('hetian:storage-error', { detail: { key, error } }));
      return false;
    }
  }
  function register(config) {
    if (!config?.namespace || !config?.key) throw new Error('Storage namespace and key are required');
    registry.set(config.namespace, { version: 1, defaults: {}, ...config });
  }
  function read(namespace) {
    const config = registry.get(namespace); if (!config) throw new Error(`Unknown storage namespace: ${namespace}`);
    const raw = readRaw(config.key); if (!raw) return clone(config.defaults);
    try { return config.migrate ? config.migrate(JSON.parse(raw)) : JSON.parse(raw); }
    catch (error) { window.HetianCore?.state?.recordError(`storage.${namespace}`, error); return clone(config.defaults); }
  }
  function write(namespace, value) {
    const config = registry.get(namespace); if (!config) throw new Error(`Unknown storage namespace: ${namespace}`);
    return writeRaw(config.key, JSON.stringify(value));
  }
  function update(namespace, mutator) { const current = read(namespace); const next = mutator(clone(current)) ?? current; write(namespace, next); return next; }
  function reportError(source, error) {
    window.HetianCore?.state?.recordError(`storage.${source}`, error);
    window.dispatchEvent(new CustomEvent('hetian:storage-error', { detail: { source, error } }));
  }
  window.HetianCore = window.HetianCore || {};
  window.HetianCore.storage = { register, read, write, update, readRaw, writeRaw, reportError, namespaces: () => [...registry.keys()] };
})();
