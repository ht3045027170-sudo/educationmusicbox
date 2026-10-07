const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const scope = { window: {}, console, performance, setTimeout, clearTimeout };
vm.createContext(scope);
for (const file of ['constants.js', 'pitch-detector.js', 'tuner-engine.js']) vm.runInContext(fs.readFileSync('vocal-pitch/' + file, 'utf8'), scope);
const { TunerEngine: E, YinPitchDetector } = scope.window.MusicVocal;
let seed = 1459;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
function signal(hz, rate, { harmonics = [1], noise = 0, decay = 0, amplitude = .35 } = {}) {
  const buffer = new Float32Array(4096);
  const sum = harmonics.reduce((a, b) => a + Math.abs(b), 0);
  for (let i = 0; i < buffer.length; i++) {
    const time = i / rate;
    buffer[i] = amplitude * (harmonics.reduce((a, v, h) => a + v * Math.sin(2 * Math.PI * hz * (h + 1) * time + .37), 0) / sum * Math.exp(-decay * time) + noise * random());
  }
  return buffer;
}
let count = 0, maxError = 0, cleanMax = 0;
for (const rate of [44100, 48000, 96000]) {
  const detector = new YinPitchDetector(rate, E.CONFIG);
  for (const midi of [36, 38, 40, 45, 50, 55, 59, 64, 69, 76, 84]) {
    for (const offset of [-35, -7, 0, 9, 38]) {
      for (const options of [{}, { harmonics:[1,.8,.6,.3], decay:5 }, { harmonics:[.35,1,.5,.2], noise:.03 }, { harmonics:[1,.6,.3], noise:.12 }]) {
        const expected = E.frequency(midi) * 2 ** (offset / 1200);
        const result = detector.detect(signal(expected, rate, options));
        const error = Math.abs(E.cents(result.frequency, expected));
        assert(result.confidence >= .85, `confidence ${rate}/${midi}/${offset}: ${result.confidence}`);
        assert(error < (options.noise >= .1 ? 12 : 4), `frequency ${rate}/${midi}/${offset}: ${error.toFixed(2)} cents, got ${result.frequency}, expected ${expected}`);
        maxError = Math.max(maxError, error); if (!options.noise) cleanMax = Math.max(cleanMax, error); count++;
      }
    }
  }
  for (let n = 0; n < 15; n++) {
    const noise = Float32Array.from({length:4096}, () => random() * .2);
    const result = detector.detect(noise);
    assert(!result.frequency || result.confidence < .85, 'white noise must not pass confidence gate');
  }
  assert.equal(detector.detect(new Float32Array(4096)).frequency, 0);
}
const tracker = new E.Tracker();
const result = frequency => ({ frequency, confidence:.99, db:-20, peak:.4 });
let reading;
for (let time=0; time<=800; time+=55) reading=tracker.update(result(440),440,time);
assert.equal(reading.state, 'in-tune');
assert.notEqual(tracker.update(result(880),440,825).state, 'in-tune');
assert(!tracker.update(result(880),440,880).frequency, 'single pitch jump must not update needle');
assert.equal(tracker.update({frequency:0,confidence:0,db:-100,peak:0},440,950).state,'quiet');
assert.equal(tracker.update(result(440),440,1400).state,'acquiring', 'reacquire after silence');
tracker.reset();
for(let time=0;time<600;time+=55) reading=tracker.update(result(220),440,time);
assert.equal(reading.state,'wrong-note', 'wrong octave must not be coerced into tune');
tracker.reset();
for(let time=0;time<600;time+=55) reading=tracker.update(result(445),440,time);
assert(reading.cents>0 && !reading.stable);
assert.equal(tracker.update({...result(440),peak:1},440,700).state,'clipping');
// Isolated excursions separated by noise must never count as one confirmed jump.
tracker.reset();
for(let time=0;time<=220;time+=55) tracker.update(result(440),440,time);
for(const time of [260,340,420]) {
 assert.equal(tracker.update(result(880),440,time).state,'unclear');
 tracker.update({frequency:0,confidence:0,db:-25,peak:.4},440,time+40);
}
assert.equal(tracker.update(result(440),440,500).state,'settling','clean target should resume without accepting separated octave spikes');
for(const name of ['E2','D2','F#3','Bb2','c4','C6']) assert(E.parseTarget(name));
for(const name of ['','E','H2','C1','D6','E22','82.4']) assert.equal(E.parseTarget(name),null);
assert.equal(E.parseTarget('A4',442).freq,442);
console.log(`PASS ${count} pitch fixtures; clean max ${cleanMax.toFixed(3)} cents, all-fixture max ${maxError.toFixed(3)} cents; noise, silence, transients, calibration, wrong octave and tracking states`);
