(() => {
  'use strict';

  const root = window.MusicVocal = window.MusicVocal || {};

  class VocalPitchPage {
    constructor(page) {
      this.page = page;
      this.config = root.CONFIG;
      this.manager = root.audioInputManager;
      this.tracker = new root.NoteStabilityTracker(this.config);
      this.renderer = new root.StaffRenderer(page.querySelector('#vocalScore'));
      this.detector = null;
      this.buffer = null;
      this.raf = 0;
      this.running = false;
      this.paused = false;
      this.lastAnalysisAt = 0;
      this.recentFrequencies = [];
      this.volumeDisplay = 0;
      this.metronomeTimer = 0;
      this.metronomeRunning = false;
      this.metronomeBeat = 0;
      this.metronomeStartedAt = 0;
      this.notes = this.loadNotes();
      this.renderer.setNotes(this.notes);
      this.cacheElements();
      this.bind();
      this.updateCount();
      this.configureDebugPanel();
    }

    cacheElements() {
      const find = id => this.page.querySelector('#' + id);
      this.ui = {
        start: find('vocalStartBtn'),
        pause: find('vocalPauseBtn'),
        clear: find('vocalClearBtn'),
        save: find('vocalSaveToggle'),
        note: find('vocalCurrentNote'),
        frequency: find('vocalFrequency'),
        db: find('vocalDb'),
        cents: find('vocalCents'),
        tuningText: find('vocalTuningText'),
        tuningNeedle: find('vocalTuningNeedle'),
        volume: find('vocalVolumeFill'),
        status: find('vocalStatus'),
        count: find('vocalNoteCount'),
        debug: find('vocalDebug'),
        rawFrequency: find('debugRawFrequency'),
        smoothFrequency: find('debugSmoothFrequency'),
        midi: find('debugMidi'),
        debugCents: find('debugCents'),
        rms: find('debugRms'),
        debugDb: find('debugDb'),
        confidence: find('debugConfidence'),
        state: find('debugState'),
        candidate: find('debugCandidate'),
        stable: find('debugStable')
      };
      this.ui.metroStart = find('vocalMetroStart');
      this.ui.metroBpm = find('vocalMetroBpm');
      this.ui.metroMeter = find('vocalMetroMeter');
      this.ui.metroBeat = find('vocalMetroBeat');
    }

    bind() {
      this.ui.start.addEventListener('click', () => this.start());
      this.ui.pause.addEventListener('click', () => this.togglePause());
      this.ui.clear.addEventListener('click', () => this.clear());
      this.ui.save.checked = localStorage.getItem(this.config.storageKey + ':enabled') !== '0';
      this.ui.save.addEventListener('change', () => {
        localStorage.setItem(this.config.storageKey + ':enabled', this.ui.save.checked ? '1' : '0');
        if (!this.ui.save.checked) localStorage.removeItem(this.config.storageKey);
        else this.persist();
      });
      this.ui.metroStart?.addEventListener('click', () => this.toggleMetronome());
    }

    configureDebugPanel() {
      const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ||
        new URLSearchParams(location.search).get('debug') === '1';
      this.ui.debug.hidden = !dev;
    }

    loadNotes() {
      try {
        if (localStorage.getItem(this.config.storageKey + ':enabled') === '0') return [];
        const parsed = JSON.parse(localStorage.getItem(this.config.storageKey) || '[]');
        return Array.isArray(parsed)
          ? parsed.filter(note => Number.isFinite(note?.midi)).slice(-this.config.maxRecordedNotes)
          : [];
      } catch (_) {
        return [];
      }
    }

    persist() {
      if (!this.ui?.save?.checked) return;
      try {
        localStorage.setItem(this.config.storageKey, JSON.stringify(this.notes));
      } catch (_) {}
    }

    async start() {
      if (this.running && !this.paused) return;
      this.setStatus('正在申请麦克风权限', 'pending');
      this.ui.start.disabled = true;
      try {
        const { context, analyser, sampleRate, native } = await this.manager.start('vocal-pitch');
        if (context?.state === 'suspended') await context.resume();
        this.detector = new root.YinPitchDetector(sampleRate || context?.sampleRate || 48000, this.config);
        this.buffer = new Float32Array(analyser.fftSize);
        this.tracker.reset();
        this.recentFrequencies.length = 0;
        this.running = true;
        this.paused = false;
        this.ui.pause.disabled = false;
        this.ui.pause.textContent = '暂停识别';
        this.ui.start.textContent = '麦克风已启动';
        this.setStatus(native ? '正在监听 · 安卓原生麦克风' : '正在监听', 'listening');
        this.loop();
      } catch (error) {
        this.running = false;
        this.paused = false;
        this.ui.start.textContent = '启动麦克风';
        this.ui.pause.disabled = true;
        this.setStatus(root.audioErrorMessage(error), 'error');
      } finally {
        this.ui.start.disabled = false;
      }
    }

    async togglePause() {
      if (!this.running || this.paused) {
        await this.start();
        return;
      }
      await this.stop('已暂停识别');
      this.paused = true;
      this.ui.pause.textContent = '恢复识别';
      this.ui.pause.disabled = false;
    }

    async stop(message = '未开启麦克风') {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      await this.manager.stop('vocal-pitch');
      this.tracker.reset();
      this.recentFrequencies.length = 0;
      this.ui.start.textContent = '启动麦克风';
      this.setStatus(message, message.includes('暂停') ? 'pending' : '');
      this.ui.volume.style.width = '0%';
    }

    clear() {
      this.notes = [];
      this.renderer.clear();
      localStorage.removeItem(this.config.storageKey);
      this.updateCount();
      this.setStatus(this.running ? '正在监听' : '乐谱已清空', this.running ? 'listening' : '');
    }

    loop(now = performance.now()) {
      if (!this.running) return;
      this.raf = requestAnimationFrame(time => this.loop(time));
      if (now - this.lastAnalysisAt < this.config.analysisIntervalMs) return;
      this.lastAnalysisAt = now;
      const analyser = this.manager.analyser;
      if (!analyser || !this.detector || !this.buffer) return;

      analyser.getFloatTimeDomainData(this.buffer);
      const detection = this.detector.detect(this.buffer);
      const smoothedFrequency = this.smoothFrequency(detection.frequency);
      // The product's teaching notation intentionally transposes detected
      // vocal pitch up one octave. Raw detector values remain visible in debug.
      const displayFrequency = smoothedFrequency *
        Math.pow(2, this.config.displayOctaveShiftSemitones / 12);
      const note = root.noteConverter.frequencyToNote(displayFrequency);
      const stable = this.tracker.update(
        { ...detection, frequency: displayFrequency },
        note,
        now
      );

      this.updateLiveUi(detection, note, stable);
      if (stable.shouldRecord && note) this.record(note, detection, now);
    }

    smoothFrequency(frequency) {
      if (!frequency) {
        this.recentFrequencies.length = 0;
        return 0;
      }
      this.recentFrequencies.push(frequency);
      if (this.recentFrequencies.length > 5) this.recentFrequencies.shift();
      const ordered = this.recentFrequencies.slice().sort((a, b) => a - b);
      return ordered[Math.floor(ordered.length / 2)];
    }

    updateLiveUi(detection, note, stable) {
      const hasPitch = Boolean(note && detection.confidence >= this.config.minConfidence);
      this.ui.note.textContent = hasPitch ? note.label : '—';
      this.ui.frequency.textContent = hasPitch ? `${note.frequency.toFixed(2)} Hz` : '-- Hz';
      this.ui.db.textContent = `${Math.max(-120, detection.db).toFixed(1)} dBFS`;
      this.ui.cents.textContent = hasPitch
        ? `${note.cents >= 0 ? '+' : ''}${note.cents.toFixed(0)} cents`
        : '-- cents';

      const cents = hasPitch ? Math.max(-50, Math.min(50, note.cents)) : 0;
      this.ui.tuningNeedle.style.transform = `translateX(${cents}%)`;
      this.ui.tuningText.textContent = !hasPitch
        ? '等待稳定音高'
        : Math.abs(note.cents) <= 5
          ? '准确'
          : note.cents < 0 ? '偏低' : '偏高';
      this.ui.tuningText.dataset.tune = !hasPitch
        ? ''
        : Math.abs(note.cents) <= 5 ? 'in' : note.cents < 0 ? 'flat' : 'sharp';

      const targetVolume = Math.max(0, Math.min(100, (detection.db + 70) / 70 * 100));
      this.volumeDisplay += (targetVolume - this.volumeDisplay) * 0.32;
      this.ui.volume.style.width = `${this.volumeDisplay.toFixed(1)}%`;

      if (detection.db < this.config.minDb) {
        this.setStatus('环境声音过小', '');
      } else if (detection.db >= this.config.clippingDb) {
        this.setStatus('输入过强，请远离麦克风', 'error');
      } else if (detection.confidence < this.config.minConfidence) {
        this.setStatus(detection.db > -38 ? '环境噪声过大' : '正在识别稳定音高', 'pending');
      } else if (stable.state === root.STATES.ATTACK) {
        this.setStatus('正在识别稳定音高', 'pending');
      } else {
        this.setStatus('正在监听', 'listening');
      }

      this.updateDebug(detection, note, stable);
    }

    updateDebug(detection, note, stable) {
      if (this.ui.debug.hidden) return;
      this.ui.rawFrequency.textContent = detection.rawFrequency?.toFixed(3) || '0';
      this.ui.smoothFrequency.textContent = stable.smoothedFrequency?.toFixed(3) || '0';
      this.ui.midi.textContent = note?.midiFloat?.toFixed(3) || '—';
      this.ui.debugCents.textContent = note?.cents?.toFixed(2) || '—';
      this.ui.rms.textContent = detection.rms.toFixed(5);
      this.ui.debugDb.textContent = detection.db.toFixed(2);
      this.ui.confidence.textContent = detection.confidence.toFixed(3);
      this.ui.state.textContent = stable.state;
      this.ui.candidate.textContent = stable.candidateMidi ?? '—';
      this.ui.stable.textContent = `${Math.round(stable.stableMs)} ms`;
    }

    record(note, detection, now) {
      const beatSeconds = 60 / Math.max(30, Number(this.ui.metroBpm?.value) || 90);
      const elapsed = this.metronomeRunning
        ? Math.max(0, (performance.now() - this.metronomeStartedAt) / 1000)
        : 0;
      const beat = this.metronomeRunning
        ? Math.round(elapsed / beatSeconds / this.config.rhythmSubdivisionBeats) *
          this.config.rhythmSubdivisionBeats
        : this.notes.length;
      if (this.notes.length && this.metronomeRunning) {
        const previous = this.notes[this.notes.length - 1];
        const rawDuration = Math.max(.25, beat - (previous.beat || 0));
        previous.durationBeats = this.nearestDuration(rawDuration);
        previous.rhythmLabel = this.rhythmLabel(previous.durationBeats);
      }
      const item = {
        midi: note.midi,
        label: note.label,
        frequency: Number(note.frequency.toFixed(3)),
        cents: Number(note.cents.toFixed(2)),
        db: Number(detection.db.toFixed(2)),
        at: Math.round(now),
        beat,
        durationBeats: 1,
        rhythmLabel: '♩',
        bpm: Number(this.ui.metroBpm?.value) || 90,
        meter: this.ui.metroMeter?.value || '4/4'
      };
      this.notes.push(item);
      if (this.notes.length > this.config.maxRecordedNotes) this.notes.shift();
      this.renderer.setNotes(this.notes);
      this.persist();
      this.updateCount();
    }

    nearestDuration(beats) {
      return this.config.rhythmDurations.reduce((best, value) =>
        Math.abs(value - beats) < Math.abs(best - beats) ? value : best,
      this.config.rhythmDurations[0]);
    }

    rhythmLabel(beats) {
      if (beats >= 4) return '𝅝';
      if (beats >= 2) return beats === 3 ? '𝅗𝅥.' : '𝅗𝅥';
      if (beats >= 1) return beats === 1.5 ? '♩.' : '♩';
      return beats <= .25 ? '𝅘𝅥𝅯' : '♪';
    }

    async toggleMetronome() {
      if (this.metronomeRunning) {
        clearInterval(this.metronomeTimer);
        this.metronomeTimer = 0;
        this.metronomeRunning = false;
        this.ui.metroStart.textContent = '启动节拍器';
        this.ui.metroBeat.textContent = '准备';
        return;
      }
      const context = await this.manager.getContext();
      if (!context) return;
      this.metronomeRunning = true;
      this.metronomeBeat = 0;
      this.metronomeStartedAt = performance.now();
      this.ui.metroStart.textContent = '停止节拍器';
      const tick = () => {
        if (!this.metronomeRunning) return;
        const beats = Number((this.ui.metroMeter.value || '4/4').split('/')[0]) || 4;
        const accent = this.metronomeBeat % beats === 0;
        const osc = context.createOscillator(), gain = context.createGain();
        osc.frequency.value = accent ? 1320 : 880;
        gain.gain.setValueAtTime(.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime((accent ? .22 : .11) * (window.HetianSettings?.getVolume?.() ?? 1), context.currentTime + .004);
        gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .055);
        osc.connect(gain); gain.connect(context.destination);
        osc.start(); osc.stop(context.currentTime + .065);
        this.ui.metroBeat.textContent = `${this.metronomeBeat % beats + 1} / ${beats}`;
        this.metronomeBeat++;
      };
      tick();
      const schedule = () => {
        clearInterval(this.metronomeTimer);
        const interval = 60000 / Math.max(30, Number(this.ui.metroBpm.value) || 90);
        this.metronomeTimer = setInterval(tick, interval);
      };
      schedule();
    }

    updateCount() {
      this.ui.count.textContent = `${this.notes.length} 个音符`;
    }

    setStatus(text, kind = '') {
      if (this.ui.status.textContent !== text) this.ui.status.textContent = text;
      this.ui.status.dataset.state = kind;
    }
  }

  function init() {
    const page = document.getElementById('vocalPitch');
    if (!page || page.dataset.ready === '1') return;
    page.dataset.ready = '1';
    const menu = document.querySelector('#menu .tool-grid');
    if (menu && !menu.querySelector('[data-page="vocalPitch"]')) {
      const button = document.createElement('button');
      button.className = 'tool-card';
      button.dataset.page = 'vocalPitch';
      button.innerHTML = '<span class="ico">♬</span><b>人声识谱</b><span class="muted">实时单音识别与五线谱记音</span>';
      menu.appendChild(button);
    }
    const controller = new VocalPitchPage(page);
    root.vocalPitchPage = controller;
    window.HetianCore?.audio?.registerStopper('vocalPitch', () => controller.stop('页面已切换'));

    document.addEventListener('click', event => {
      const target = event.target.closest?.('[data-page]');
      if (!target) return;
      setTimeout(() => {
        if (target.dataset.page !== 'vocalPitch') controller.stop();
      }, 0);
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) controller.stop();
    });
    window.addEventListener('pagehide', () => controller.stop());
    window.addEventListener('beforeunload', () => root.audioInputManager.stopAll());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
