(() => {
  'use strict';

  // 吉他六根弦的真实采样（原声钢弦吉他，CC-BY 3.0）。
  // 仅用于调音器的「弦标准音示范」：点琴钮时播放该弦正确音高，供耳朵比对。
  const NOTES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
  const audios = new Map();
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
    audios.forEach(a => {
      try { a.pause(); a.currentTime = 0; } catch (_) {}
    });
  }

  window.HetianGuitar = { prepare, play, stopAll, NOTES };
  document.addEventListener('pointerdown', () => prepare(), { once: true, passive: true });
})();
