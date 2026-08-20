(() => {
  'use strict';
  const NS = window.MusicScore = window.MusicScore || {};
  class PlaybackEngine {
    constructor(onPosition = () => {}, onState = () => {}) {
      this.onPosition = onPosition; this.onState = onState; this.context = null;
      this.master = null; this.timer = 0; this.raf = 0; this.voices = new Set();
      this.playing = false; this.offsetBeat = 0; this.startedAt = 0; this.score = null;
    }
    ensure() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('当前浏览器不支持 Web Audio API');
      if (!this.context || this.context.state === 'closed') {
        this.context = window.HetianCore?.audio?.getContext?.() || new AudioContext(); this.master = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -6; limiter.ratio.value = 12;
        this.master.connect(limiter); limiter.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume();
      return this.context;
    }
    buildEvents(score) {
      const beatsPerMeasure = +(score.settings.meter.split('/')[0]) || 4;
      const solo = score.parts.some(part => part.solo);
      const events = [];
      score.parts.forEach(part => {
        if (part.mute || (solo && !part.solo)) return;
        score.measures.forEach((measure, measureIndex) => measure.voices.forEach(voice => voice.filter(event => !event.partId || event.partId === part.id).forEach(event => {
          if (event.type !== 'note' || event.play === false) return;
          events.push({ ...event, beat: measureIndex * beatsPerMeasure + event.start, part });
        })));
      });
      return events.sort((a, b) => a.beat - b.beat);
    }
    scheduleNote(event, when, seconds) {
      const context = this.ensure(), output = context.createGain(), pan = context.createStereoPanner();
      const envelope = context.createGain(), filter = context.createBiquadFilter();
      const frequency = 440 * Math.pow(2, (event.midi - 69) / 12);
      output.gain.value = Math.max(.02, event.part.volume || .8);
      pan.pan.value = event.part.pan || 0; filter.type = 'lowpass'; filter.frequency.value = 7200;
      envelope.gain.setValueAtTime(.0001, when);
      envelope.gain.exponentialRampToValueAtTime(.18 * (event.velocity / 127), when + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, when + Math.max(.09, seconds));
      envelope.connect(filter); filter.connect(output); output.connect(pan); pan.connect(this.master);
      const partials = event.part.tone === 'guitar' ? [[1,'triangle',1],[2,'sine',.2],[3,'sine',.08]]
        : event.part.tone === 'choir' ? [[1,'sine',1],[2,'sine',.36],[3,'sine',.18]]
        : [[1,'triangle',1],[2,'sine',.32],[3,'sine',.13],[4,'sine',.06]];
      partials.forEach(([ratio, type, gainValue]) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = type; oscillator.frequency.value = frequency * ratio; gain.gain.value = gainValue;
        oscillator.connect(gain); gain.connect(envelope); oscillator.start(when); oscillator.stop(when + seconds + .06);
        this.voices.add(oscillator); oscillator.onended = () => this.voices.delete(oscillator);
      });
    }
    play(score, fromBeat = this.offsetBeat) {
      this.stop(false); this.score = score; this.ensure();
      this.master.gain.value = (score.settings.masterVolume ?? .82) * (window.HetianSettings?.getVolume?.() ?? 1);
      this.events = this.buildEvents(score); this.offsetBeat = Math.max(0, fromBeat);
      this.startedAt = this.context.currentTime; this.nextIndex = this.events.findIndex(event => event.beat >= this.offsetBeat);
      if (this.nextIndex < 0) this.nextIndex = this.events.length;
      this.playing = true; this.onState('playing'); this.tick(); this.animate();
    }
    tick() {
      if (!this.playing) return;
      const beatSeconds = 60 / Math.max(30, +this.score.settings.tempo || 120);
      const currentBeat = this.offsetBeat + (this.context.currentTime - this.startedAt) / beatSeconds;
      const horizon = currentBeat + .18 / beatSeconds;
      while (this.nextIndex < this.events.length && this.events[this.nextIndex].beat <= horizon) {
        const event = this.events[this.nextIndex++], delay = Math.max(0, event.beat - currentBeat) * beatSeconds;
        this.scheduleNote(event, this.context.currentTime + delay, Math.max(.06, event.duration * beatSeconds * .92));
      }
      if (this.score.settings.metronome) {
        const integerBeat = Math.ceil(currentBeat);
        if (integerBeat !== this.lastMetroBeat && integerBeat <= horizon) {
          const beatsPerMeasure = +(this.score.settings.meter.split('/')[0]) || 4;
          this.lastMetroBeat = integerBeat; this.click(this.context.currentTime + Math.max(0, integerBeat - currentBeat) * beatSeconds, integerBeat % beatsPerMeasure === 0);
        }
      }
      const total = this.score.measures.length * (+(this.score.settings.meter.split('/')[0]) || 4);
      if (currentBeat >= total) { this.stop(true); return; }
      this.timer = setTimeout(() => this.tick(), 25);
    }
    click(when, accent) {
      const oscillator = this.context.createOscillator(), gain = this.context.createGain();
      oscillator.frequency.value = accent ? 1200 : 760; gain.gain.setValueAtTime(.12, when);
      gain.gain.exponentialRampToValueAtTime(.0001, when + .045);
      oscillator.connect(gain); gain.connect(this.master); oscillator.start(when); oscillator.stop(when + .05);
    }
    animate() {
      if (!this.playing) return;
      const beat = this.offsetBeat + (this.context.currentTime - this.startedAt) / (60 / this.score.settings.tempo);
      this.onPosition(beat); this.raf = requestAnimationFrame(() => this.animate());
    }
    pause() {
      if (!this.playing) return;
      this.offsetBeat += (this.context.currentTime - this.startedAt) / (60 / this.score.settings.tempo);
      this.stop(false); this.onState('paused');
    }
    stop(reset = true) {
      clearTimeout(this.timer); cancelAnimationFrame(this.raf); this.playing = false;
      this.voices.forEach(voice => { try { voice.stop(); } catch (_) {} }); this.voices.clear();
      if (reset) this.offsetBeat = 0;
      this.onPosition(this.offsetBeat); this.onState(reset ? 'stopped' : 'paused');
    }
  }
  NS.PlaybackEngine = PlaybackEngine;
})();
