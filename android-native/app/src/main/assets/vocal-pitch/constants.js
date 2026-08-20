(() => {
  'use strict';

  const root = window.MusicVocal = window.MusicVocal || {};

  /**
   * All recognition thresholds live here so later tuning does not require
   * hunting through rendering or audio code.
   */
  root.CONFIG = Object.freeze({
    minFrequency: 65.41,
    maxFrequency: 1046.5,
    analysisMinFrequency: 60,
    analysisMaxFrequency: 1200,
    fftSize: 4096,
    analysisIntervalMs: 55,
    displayOctaveShiftSemitones: 12,
    rhythmSubdivisionBeats: 0.25,
    rhythmDurations: [0.25, 0.5, 1, 1.5, 2, 3, 4],
    minDb: -55,
    releaseDb: -62,
    clippingDb: -1.5,
    minConfidence: 0.78,
    stableMs: 200,
    centsTolerance: 35,
    repeatCooldownMs: 300,
    noteChangeSemitones: 0.65,
    maxRecordedNotes: 256,
    storageKey: 'jadeVocalPitchScoreV1'
  });

  root.STATES = Object.freeze({
    SILENCE: 'SILENCE',
    ATTACK: 'ATTACK',
    STABLE: 'STABLE',
    RECORDED: 'RECORDED',
    RELEASE: 'RELEASE'
  });
})();
