(() => {
  'use strict';

  const root = window.MusicVocal = window.MusicVocal || {};

  /**
   * YIN estimates the fundamental from the waveform's periodicity rather than
   * selecting the loudest FFT bin. This prevents strong vocal harmonics from
   * being reported as separate notes or as an octave-high fundamental.
   */
  class YinPitchDetector {
    constructor(sampleRate, config = root.CONFIG) {
      this.sampleRate = sampleRate;
      this.config = config;
      this.difference = new Float32Array(
        Math.ceil(sampleRate / config.analysisMinFrequency) + 2
      );
      this.cmnd = new Float32Array(this.difference.length);
    }

    detect(buffer) {
      const { sampleRate, config } = this;
      let sumSquares = 0;
      let peak = 0;
      for (let i = 0; i < buffer.length; i++) {
        const value = buffer[i];
        sumSquares += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -120;
      if (db < config.releaseDb || peak > 1.02) {
        return { frequency: 0, rawFrequency: 0, confidence: 0, rms, db, peak };
      }

      const minTau = Math.max(2, Math.floor(sampleRate / config.analysisMaxFrequency));
      const maxTau = Math.min(
        this.difference.length - 2,
        Math.floor(sampleRate / config.analysisMinFrequency),
        Math.floor(buffer.length / 2)
      );

      this.difference.fill(0, 0, maxTau + 1);
      for (let tau = minTau; tau <= maxTau; tau++) {
        let difference = 0;
        const limit = buffer.length - tau;
        for (let i = 0; i < limit; i++) {
          const delta = buffer[i] - buffer[i + tau];
          difference += delta * delta;
        }
        this.difference[tau] = difference;
      }

      this.cmnd.fill(1, 0, maxTau + 1);
      let runningSum = 0;
      for (let tau = 1; tau <= maxTau; tau++) {
        runningSum += this.difference[tau];
        this.cmnd[tau] = runningSum > 0
          ? this.difference[tau] * tau / runningSum
          : 1;
      }

      let tauEstimate = -1;
      const threshold = 0.15;
      for (let tau = minTau; tau <= maxTau; tau++) {
        if (this.cmnd[tau] < threshold) {
          while (tau + 1 <= maxTau && this.cmnd[tau + 1] < this.cmnd[tau]) tau++;
          tauEstimate = tau;
          break;
        }
      }

      if (tauEstimate < 0) {
        let bestValue = 1;
        for (let tau = minTau; tau <= maxTau; tau++) {
          if (this.cmnd[tau] < bestValue) {
            bestValue = this.cmnd[tau];
            tauEstimate = tau;
          }
        }
      }

      if (tauEstimate < 0) {
        return { frequency: 0, rawFrequency: 0, confidence: 0, rms, db, peak };
      }

      const left = this.cmnd[Math.max(minTau, tauEstimate - 1)];
      const center = this.cmnd[tauEstimate];
      const right = this.cmnd[Math.min(maxTau, tauEstimate + 1)];
      const denominator = 2 * (2 * center - right - left);
      const shift = Math.abs(denominator) > 1e-8 ? (right - left) / denominator : 0;
      const refinedTau = tauEstimate + Math.max(-1, Math.min(1, shift));
      let frequency = sampleRate / refinedTau;
      const confidence = Math.max(0, Math.min(1, 1 - center));

      if (frequency < config.minFrequency || frequency > config.maxFrequency) {
        frequency = 0;
      }

      return {
        frequency,
        rawFrequency: frequency,
        confidence,
        rms,
        db,
        peak
      };
    }
  }

  root.YinPitchDetector = YinPitchDetector;
})();
