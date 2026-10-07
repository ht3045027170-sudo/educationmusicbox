(() => {
  'use strict';
  const root = window.MusicVocal = window.MusicVocal || {};
  const CONFIG = Object.freeze({ minFrequency: 25, maxFrequency: 1250, analysisMinFrequency: 22, analysisMaxFrequency: 1400, fftSize: 4096, releaseDb: -58 });
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const frequency = (midi, reference = 440) => reference * 2 ** ((midi - 69) / 12);
  const cents = (actual, target) => 1200 * Math.log2(actual / target);
  const noteName = midi => names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  function parseTarget(value, reference = 440) {
    const match = String(value).trim().match(/^([A-Ga-g])([#b♯♭]?)([2-6])$/);
    if (!match) return null;
    const letter = match[1].toUpperCase(), accidental = match[2].replace('♯', '#').replace('♭', 'b');
    const midi = (Number(match[3]) + 1) * 12 + { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
    return midi >= 36 && midi <= 84 ? { midi, note: letter + accidental + match[3], freq: frequency(midi, reference) } : null;
  }
  // Time-based tracking avoids treating a single transient as a successful tuning.
  class Tracker {
    constructor() { this.reset(); }
    reset() { this.history = []; this.lastValid = -Infinity; this.inTuneSince = null; this.target = null; this.lastCents = null; this.candidate = null; this.candidateCount = 0; }
    update(result, target, now) {
      if (target !== this.target) { this.reset(); this.target = target; }
      const valid = Number.isFinite(result.frequency) && result.frequency > 0 && result.confidence >= .85 && result.db >= CONFIG.releaseDb && result.peak < .98;
      if (!valid) {
        this.inTuneSince = null;
        // Confirmation requires uninterrupted valid frames.
        this.candidate = null; this.candidateCount = 0;
        if (now - this.lastValid >= 350) { this.history = []; this.lastCents = null; }
        return { state: result.peak >= .98 ? 'clipping' : result.db < CONFIG.releaseDb ? 'quiet' : 'unclear', level: result.db };
      }
      if (now - this.lastValid >= 350) this.history = [];
      if (this.history.length && Math.abs(cents(result.frequency, this.history.at(-1))) > 80) {
        this.candidateCount = this.candidate && Math.abs(cents(result.frequency, this.candidate)) < 35 ? this.candidateCount + 1 : 1;
        this.candidate = result.frequency;
        this.inTuneSince = null;
        if (this.candidateCount < 3) return { state: 'unclear', level: result.db };
        this.history = [];
      }
      this.candidate = null; this.candidateCount = 0;
      this.lastValid = now;
      this.history.push(result.frequency);
      if (this.history.length > 5) this.history.shift();
      const ordered = [...this.history].sort((a, b) => a - b);
      const measured = ordered[Math.floor(ordered.length / 2)];
      const deviation = cents(measured, target);
      if (this.history.length < 3) return { state: 'acquiring', level: result.db };
      if (Math.abs(deviation) > 200) { this.inTuneSince = null; return { state: 'coarse', frequency: measured, cents: deviation, level: result.db, stable: false }; }
      // Raw readings must also be in range: smoothing alone must never grant success.
      const steady = this.history.length >= 3 && Math.abs(deviation) <= 3 && Math.abs(cents(result.frequency, target)) <= 4;
      if (steady) this.inTuneSince ??= now; else this.inTuneSince = null;
      const stable = this.inTuneSince !== null && now - this.inTuneSince >= 450;
      this.lastCents = deviation;
      return { state: stable ? 'in-tune' : steady ? 'settling' : 'tracking', frequency: measured, cents: deviation, level: result.db, stable };
    }
  }
  // Own the whole request lifecycle, including a permission response arriving after stop.
  class Input {
    constructor() { this.generation = 0; this.pending = null; this.stream = null; this.nodes = []; this.native = false; this.analyser = null; }
    start() {
      if (this.analyser) return Promise.resolve(this);
      if (this.pending) return this.pending;
      const generation = ++this.generation;
      const cancelled = () => generation !== this.generation;
      const aborted = () => Object.assign(new Error('调音已停止'), { name: 'AbortError' });
      let request;
      request = (async () => {
        await Promise.resolve();
        try {
          const bridge = window.AndroidAudio;
          if (bridge?.startCapture) {
            if (!bridge.hasPermission()) {
              bridge.requestPermission();
              const began = performance.now();
              while (!bridge.hasPermission()) {
                if (cancelled()) throw aborted();
                if (performance.now() - began > 12000) throw Object.assign(new Error('请允许麦克风权限后重试'), { name: 'NotAllowedError' });
                await new Promise(resolve => setTimeout(resolve, 150));
              }
            }
            if (cancelled()) throw aborted();
            if (!bridge.startCapture()) throw new Error('原生麦克风启动失败，请重试');
            this.native = true;
            this.sampleRate = Number(bridge.getSampleRate()) || 48000;
            this.analyser = new root.NativePcmAnalyser(bridge, CONFIG.fftSize);
            return this;
          }
          if (!navigator.mediaDevices?.getUserMedia) throw new Error('请使用 HTTPS 网页或 localhost，并确认设备有麦克风');
          const context = window.HetianCore.audio.getContext();
          await context.resume();
          if (cancelled()) throw aborted();
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 1 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
          if (cancelled()) { stream.getTracks().forEach(track => track.stop()); throw aborted(); }
          this.stream = stream;
          const source = context.createMediaStreamSource(stream);
          this.nodes.push(source);
          const high = context.createBiquadFilter(); this.nodes.push(high);
          const low = context.createBiquadFilter(); this.nodes.push(low);
          const analyser = context.createAnalyser(); this.nodes.push(analyser);
          high.type = 'highpass'; high.frequency.value = 35;
          low.type = 'lowpass'; low.frequency.value = 1800;
          analyser.fftSize = CONFIG.fftSize; analyser.smoothingTimeConstant = 0;
          source.connect(high); high.connect(low); low.connect(analyser);
          this.analyser = analyser; this.sampleRate = context.sampleRate;
          return this;
        } catch (error) {
          if (!cancelled()) this.stop();
          throw error;
        } finally { if (this.pending === request) this.pending = null; }
      })();
      this.pending = request;
      return request;
    }
    stop() {
      this.generation++;
      this.pending = null;
      this.nodes.forEach(node => { try { node.disconnect(); } catch (_) {} });
      this.stream?.getTracks().forEach(track => track.stop());
      if (this.native) { try { window.AndroidAudio.stopCapture(); } catch (_) {} }
      this.nodes = []; this.stream = null; this.native = false; this.analyser = null;
    }
  }
  root.TunerEngine = { CONFIG, frequency, cents, noteName, parseTarget, Tracker, Input };
})();
