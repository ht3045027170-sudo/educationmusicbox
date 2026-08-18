(() => {
  'use strict';

  const ROOTS = [];
  const buffers = new Map();
  const nativeSamples = new Map();
  let preparePromise = null;
  let nativeReady = false;
  const names = [];
  for (let octave = 0; octave <= 7; octave += 1) names.push([`A${octave}v6.mp3`, 21 + octave * 12]);
  for (let octave = 1; octave <= 8; octave += 1) names.push([`C${octave}v6.mp3`, 12 + octave * 12]);
  for (let octave = 1; octave <= 7; octave += 1) names.push([`D#${octave}v6.mp3`, 15 + octave * 12], [`F#${octave}v6.mp3`, 18 + octave * 12]);
  names.forEach(([file, midi]) => ROOTS.push({ file, midi }));
  ROOTS.sort((a, b) => a.midi - b.midi);
  const PLAYBACK_ROOTS = ROOTS.filter(root => root.midi >= 45 && root.midi <= 84);
  const sampleUrl = root => new URL(`sight-singing/piano-samples/package/audio/${encodeURIComponent(root.file)}`, document.baseURI).href;

  async function prepare(context) {
    if (location.protocol === 'file:') {
      PLAYBACK_ROOTS.forEach(root => nativeSamples.set(root.midi, sampleUrl(root)));
      nativeReady = true;
      return true;
    }
    if (buffers.size === PLAYBACK_ROOTS.length) return true;
    if (preparePromise) return preparePromise;
    preparePromise = (async () => {
      for (const root of PLAYBACK_ROOTS) {
        if (buffers.has(root.midi)) continue;
        const response = await fetch(sampleUrl(root));
        if (!response.ok) throw new Error(`钢琴采样读取失败：${root.file}`);
        buffers.set(root.midi, await context.decodeAudioData(await response.arrayBuffer()));
      }
      return true;
    })().finally(() => { preparePromise = null; });
    return preparePromise;
  }

  function nearestRoot(midi) {
    return PLAYBACK_ROOTS.reduce((best, item) => Math.abs(item.midi - midi) < Math.abs(best.midi - midi) ? item : best, PLAYBACK_ROOTS[0]);
  }

  function createVoice(context, midi, velocity = .72, when = context.currentTime) {
    const root = nearestRoot(midi);
    if (nativeReady) {
      const audio = new Audio(nativeSamples.get(root.midi));
      audio.preload = 'auto';
      audio.playbackRate = Math.pow(2, (midi - root.midi) / 12);
      audio.volume = Math.max(.03, Math.min(1, velocity * .72));
      const delay = Math.max(0, (when - context.currentTime) * 1000);
      const startTimer = window.setTimeout(() => audio.play().catch(() => {}), delay);
      const node = { addEventListener:(...args) => audio.addEventListener(...args), stop:() => { clearTimeout(startTimer); audio.pause(); try { audio.currentTime = 0; } catch (_) {} } };
      let released = false;
      return { context, gain:null, sources:[node], oscillators:[node], midi, release() { if (released) return; released = true; node.stop(); } };
    }
    const buffer = buffers.get(root.midi);
    if (!buffer) return null;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, (midi - root.midi) / 12);
    filter.type = 'lowpass';
    filter.frequency.value = 5800;
    filter.Q.value = .35;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    const attackEnd = when + .008;
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(.025, velocity * .62), attackEnd);
    source.start(when);
    let released = false;
    return {
      context, gain, sources: [source], oscillators: [source], midi,
      release(tail = .55) {
        if (released) return;
        released = true;
        const now = Math.max(context.currentTime, when);
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(.0001, gain.gain.value), now);
        gain.gain.exponentialRampToValueAtTime(.0001, now + Math.max(.08, tail));
        try { source.stop(now + Math.max(.1, tail) + .04); } catch (_) {}
      }
    };
  }

  function play(context, midi, when, duration, velocity = .72) {
    const voice = createVoice(context, midi, velocity, when);
    if (!voice) return null;
    const releaseAt = Math.max(0, (when - context.currentTime + Math.max(.12, duration * .82)) * 1000);
    window.setTimeout(() => voice.release(.12), releaseAt);
    return voice;
  }

  window.HetianPiano = {
    prepare,
    play,
    createVoice,
    isReady: () => nativeReady || buffers.size === PLAYBACK_ROOTS.length,
    attribution: 'Salamander Grand Piano V3 — Alexander Holm, CC BY 3.0'
  };
  document.addEventListener('pointerdown', () => {
    try {
      const context = window.HetianApp?.getAudio?.();
      if (context) prepare(context).catch(() => {});
    } catch (_) {}
  }, { once: true, passive: true });
})();
