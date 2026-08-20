(() => {
  'use strict';

  const root = window.MusicVocal = window.MusicVocal || {};

  class NoteStabilityTracker {
    constructor(config = root.CONFIG) {
      this.config = config;
      this.reset();
    }

    reset() {
      this.state = root.STATES.SILENCE;
      this.candidateMidi = null;
      this.candidateSince = 0;
      this.lastRecordedMidi = null;
      this.lastRecordedAt = -Infinity;
      this.smoothedFrequency = 0;
      this.lastVoicedAt = 0;
    }

    update(detection, note, now = performance.now()) {
      const valid = Boolean(
        note &&
        detection.db >= this.config.minDb &&
        detection.confidence >= this.config.minConfidence
      );

      if (!valid) {
        if (detection.db < this.config.releaseDb) {
          this.state = this.state === root.STATES.SILENCE
            ? root.STATES.SILENCE
            : root.STATES.RELEASE;
          if (now - this.lastVoicedAt > 110) {
            this.state = root.STATES.SILENCE;
            this.candidateMidi = null;
            this.candidateSince = 0;
            this.smoothedFrequency = 0;
          }
        }
        return this.snapshot(false, now);
      }

      this.lastVoicedAt = now;
      this.smoothedFrequency = this.smoothedFrequency
        ? this.smoothedFrequency * 0.72 + detection.frequency * 0.28
        : detection.frequency;

      const midiDistance = this.candidateMidi === null
        ? Infinity
        : Math.abs(note.midiFloat - this.candidateMidi);
      const sameCandidate = midiDistance <= this.config.noteChangeSemitones;

      if (!sameCandidate) {
        this.candidateMidi = note.midi;
        this.candidateSince = now;
        this.state = root.STATES.ATTACK;
        return this.snapshot(false, now);
      }

      const stableFor = now - this.candidateSince;
      const centeredEnough = Math.abs(note.cents) <= this.config.centsTolerance;
      if (
        stableFor >= this.config.stableMs &&
        centeredEnough &&
        this.state !== root.STATES.RECORDED
      ) {
        this.state = root.STATES.STABLE;
        const sameAsLast = this.lastRecordedMidi === note.midi;
        const cooldownReady = now - this.lastRecordedAt >= this.config.repeatCooldownMs;
        if ((!sameAsLast || cooldownReady) && cooldownReady) {
          this.state = root.STATES.RECORDED;
          this.lastRecordedMidi = note.midi;
          this.lastRecordedAt = now;
          return this.snapshot(true, now);
        }
      }

      // A held note remains RECORDED and cannot retrigger until silence or a
      // different stable pitch creates a new ATTACK.
      if (this.state !== root.STATES.RECORDED) this.state = root.STATES.ATTACK;
      return this.snapshot(false, now);
    }

    snapshot(shouldRecord, now) {
      return {
        state: this.state,
        candidateMidi: this.candidateMidi,
        stableMs: this.candidateSince ? Math.max(0, now - this.candidateSince) : 0,
        smoothedFrequency: this.smoothedFrequency,
        shouldRecord
      };
    }
  }

  root.NoteStabilityTracker = NoteStabilityTracker;
})();
