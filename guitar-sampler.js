(() => {
  'use strict';

  // 吉他六根弦的真实采样（原声钢弦吉他，CC-BY 3.0）。
  // 空弦示范与指板共用同一采样；品位通过对应琴弦的采样变调。
  const NOTES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
  const MIDIS = [40, 45, 50, 55, 59, 64];
  const audios = new Map();
  const buffers = new Map(), voices = new Set();
  let loading = null;
  let prepared = false;
  const url = note => new URL(`guitar-samples/${note}.wav`, document.baseURI).href;

  function prepare() {
    if (prepared) return;
    prepared = true;
    NOTES.forEach(note => {
      try {
        const audio = new Audio(url(note));
        audio.preload = 'auto';
        audios.set(note, audio);
      } catch (_) {}
    });
  }

  // 播放某根弦的标准音，自动切断正在播放的其他示范音（新音切断旧音）。
  function play(note, volume = 1) {
    prepare();
    const audio = audios.get(note);
    if (!audio) return null;
    stopAll();
    const gv = window.HetianSettings?.getVolume?.() ?? 1;
    audio.volume = Math.max(0.03, Math.min(1, volume * gv));
    try {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
    return audio;
  }

  function stopAll() {
    voices.forEach(voice => voice.stop());
    voices.clear();
    audios.forEach(a => {
      try { a.pause(); a.currentTime = 0; } catch (_) {}
    });
  }

  async function prepareSamples(context) {
    if (location.protocol === 'file:' || buffers.size === NOTES.length) return true;
    if (!loading) loading = Promise.all(NOTES.map(async note => {
      if (buffers.has(note)) return;
      const response = await fetch(url(note));
      if (!response.ok) throw new Error('吉他采样读取失败：' + note);
      buffers.set(note, await context.decodeAudioData(await response.arrayBuffer()));
    })).then(() => true).finally(() => { loading = null; });
    return loading;
  }

  function playSample(context, midi, when, duration = 1.5, volume = .5, stringMidi) {
    const rootIndex = MIDIS.includes(stringMidi) ? MIDIS.indexOf(stringMidi)
      : MIDIS.reduce((best, value, i) => Math.abs(value - midi) < Math.abs(MIDIS[best] - midi) ? i : best, 0);
    const rate = 2 ** ((midi - MIDIS[rootIndex]) / 12);
    const level = Math.max(0, Math.min(1, volume * (window.HetianSettings?.getVolume?.() ?? 1)));
    let voice;
    if (location.protocol === 'file:') {
      const audio = new Audio(url(NOTES[rootIndex]));
      audio.preservesPitch = false;
      audio.mozPreservesPitch = false;
      audio.webkitPreservesPitch = false;
      audio.playbackRate = rate;
      audio.volume = level;
      let endTimer;
      const startTimer = setTimeout(() => {
        audio.play().catch(() => voice.stop());
        endTimer = setTimeout(() => voice.stop(), duration * 1000);
      }, Math.max(0, (when - context.currentTime) * 1000));
      voice = { stop() { clearTimeout(startTimer); clearTimeout(endTimer); audio.pause(); voices.delete(voice); } };
      audio.addEventListener('ended', () => voice.stop(), { once: true });
    } else {
      const buffer = buffers.get(NOTES[rootIndex]);
      if (!buffer) throw new Error('吉他采样尚未加载');
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; source.playbackRate.value = rate;
      source.connect(gain); gain.connect(context.destination);
      const start = Math.max(when, context.currentTime), end = start + Math.max(.12, duration);
      gain.gain.setValueAtTime(level, start);
      gain.gain.setValueAtTime(level, Math.max(start, end - .1));
      gain.gain.linearRampToValueAtTime(0, end);
      source.start(start); source.stop(end + .02);
      voice = { stop() { try { source.stop(); } catch (_) {} gain.disconnect(); voices.delete(voice); } };
      source.addEventListener('ended', () => voice.stop(), { once: true });
    }
    voices.add(voice);
    return voice;
  }

  window.HetianGuitar = { prepare, prepareSamples, play, playSample, stopAll, NOTES };
  window.addEventListener('musictoolbox:stopaudio', stopAll);
  window.addEventListener('pagehide', stopAll);
  document.addEventListener('pointerdown', () => prepare(), { once: true, passive: true });
})();
