(() => {
  'use strict';
  let context = null;
  const stoppers = new Map();
  function getContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Current browser does not support Web Audio API');
    if (!context || context.state === 'closed') context = new AudioContext();
    if (context.state === 'suspended') context.resume().catch(error => window.HetianCore?.state?.recordError('audio.resume', error));
    window.HetianCore?.state?.patch('audio', { contextState: context.state }, { source: 'audio-manager' });
    return context;
  }
  function registerStopper(owner, stopper) {
    const key = String(owner || 'general');
    if (!stoppers.has(key)) stoppers.set(key, new Set());
    stoppers.get(key).add(stopper);
    return () => stoppers.get(key)?.delete(stopper);
  }
  function stop(owner, reason = 'manual') {
    const key = String(owner || 'general');
    [...(stoppers.get(key) || [])].forEach(stopper => { try { stopper(reason); } catch (error) { window.HetianCore?.state?.recordError(`audio.${key}`, error); } });
    if (window.HetianCore?.state?.get('audio.inputOwner') === key) window.HetianCore.state.patch('audio', { inputOwner: '' }, { source: 'audio-manager' });
  }
  function stopAll(reason = 'manual') { [...stoppers.keys()].forEach(owner => stop(owner, reason)); }
  function claimInput(owner) {
    const current = window.HetianCore?.state?.get('audio.inputOwner');
    if (current && current !== owner) stop(current, 'input-taken');
    window.HetianCore?.state?.patch('audio', { inputOwner: owner }, { source: 'audio-manager' });
  }
  window.HetianCore = window.HetianCore || {};
  window.HetianCore.audio = { getContext, registerStopper, stop, stopAll, claimInput, context: () => context };
})();
