(() => {
  'use strict';
  class TuningSession {
    constructor(targets, instrument) {
      this.instrument = instrument;
      this.rows = [...new Set(targets)].map(note => ({ note, samples: 0, stableCount: 0, lowCount: 0, highCount: 0, sum: 0, last: -Infinity }));
    }
    add(reading) {
      const row = this.rows.find(row => row.note === reading.note);
      if (!row || reading.instrument !== this.instrument || !Number.isFinite(reading.at) || !Number.isFinite(reading.cents) || Math.abs(reading.cents) > 200 || reading.at - row.last < 200 || row.samples >= 3600) return false;
      row.last = reading.at; row.samples++; row.sum += reading.cents;
      if (reading.stable === true) row.stableCount++;
      if (reading.cents < -5) row.lowCount++;
      if (reading.cents > 5) row.highCount++;
      return true;
    }
    summary() {
      return this.rows.map(({ note, samples, stableCount, lowCount, highCount, sum }) => ({ note, samples, stableCount, lowCount, highCount, meanCents: samples ? Math.round(sum / samples * 10) / 10 : 0 }));
    }
    completed() { return this.rows.filter(row => row.samples >= 3 && row.stableCount > 0).length; }
  }
  window.MusicVocal.TuningSession = TuningSession;
})();
