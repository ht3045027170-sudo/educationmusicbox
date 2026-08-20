(() => {
  'use strict';

  const root = window.MusicVocal = window.MusicVocal || {};
  const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  function frequencyToNote(frequency) {
    if (!Number.isFinite(frequency) || frequency <= 0) return null;
    const midiFloat = 69 + 12 * Math.log2(frequency / 440);
    const midi = Math.round(midiFloat);
    const standardFrequency = 440 * Math.pow(2, (midi - 69) / 12);
    const cents = 1200 * Math.log2(frequency / standardFrequency);
    const pitchClass = ((midi % 12) + 12) % 12;
    return {
      frequency,
      midi,
      midiFloat,
      name: NOTE_NAMES[pitchClass],
      octave: Math.floor(midi / 12) - 1,
      label: NOTE_NAMES[pitchClass] + (Math.floor(midi / 12) - 1),
      standardFrequency,
      cents,
      isSharp: [1, 3, 6, 8, 10].includes(pitchClass)
    };
  }

  root.noteConverter = { frequencyToNote, NOTE_NAMES };
})();
