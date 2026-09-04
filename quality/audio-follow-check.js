const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const parser = html.match(/function parseTunerTarget\(value\)\{.*\}/)[0];
const tuner = vm.createContext({ midiFreq: midi => 440 * 2 ** ((midi - 69) / 12) });
vm.runInContext(parser, tuner);
for (const name of ['E2', 'D2', 'F#3', 'Bb2', 'c4', 'C6']) assert(tuner.parseTunerTarget(name), name);
for (const name of ['', 'E', 'H2', 'C1', 'D6', 'E22', '82.4']) assert.equal(tuner.parseTunerTarget(name), null, name);
const target = tuner.parseTunerTarget('E2').freq;
for (const [frequency, sign] of [[73.4162, -1], [87.3071, 1], [target / 2, -1], [target * 2, 1]]) {
  assert.equal(Math.sign(1200 * Math.log2(frequency / target)), sign);
}
const scope = { window: {} }; vm.runInNewContext(fs.readFileSync('sight-singing/score-layout.js', 'utf8'), scope);
const engine = scope.window.HetianScoreLayout;
const image = { width: 1000, height: 500, data: new Uint8ClampedArray(1000 * 500 * 4).fill(255) };
function ink(x, y) { const i = (y * image.width + x) * 4; image.data[i] = image.data[i + 1] = image.data[i + 2] = 0; }
function row(top, bars) {
  for (let line = 0; line < 5; line++) for (let x = 50; x <= 950; x++) ink(x, top + line * 12);
  for (const x of bars) for (let y = top; y <= top + 48; y++) ink(x, y);
}
function head(x, y) { for (let dy = -5; dy <= 5; dy++) for (let dx = -7; dx <= 7; dx++) if (dx * dx / 49 + dy * dy / 25 <= 1) ink(x + dx, y + dy); }
row(80, [50, 290, 610, 950]); row(300, [50, 450, 950]); // Different widths AND counts per row.
const notes = [], targets = [[160, 116], [410, 116], [780, 116], [210, 336], [720, 336]];
targets.forEach(([x, y], i) => { head(x, y); notes.push({ id: 'n' + i, measure: i + 1, name: 'G', octave: 4, duration: 4 }); });
const layout = engine.detect(image);
assert.deepEqual(Array.from(layout.rows, r => r.measures.length), [3, 2]);
const mapped = engine.mapNotes(image, layout, notes, 'treble'); assert(mapped.exact);
targets.forEach(([x, y], i) => { const p = mapped.positions.get('n' + i); assert(p); assert(Math.abs(p.x * 10 - x) <= 3, 'head x ' + i); assert(Math.abs(p.y * 5 - y) < .001); });
const mismatch = engine.mapNotes(image, layout, [...notes, { id: 'extra', measure: 6 }]);
assert(!mismatch.exact); assert.equal(mismatch.positions.size, 0, 'Mismatch must not silently jump to guessed rows');
const located = engine.mapNotes(image, layout, [{ id: 'manual', measure: 1, position: { xPct: 22, yPct: 44, manual: true } }]);
assert.equal(located.positions.get('manual').x, 22);
const events = [{ start: 10, end: 10.5 }, { start: 10.5, end: 11.5 }];
assert.equal(engine.eventAtTime(events, 9.9), -1); assert.equal(engine.eventAtTime(events, 10.49), 0);
assert.equal(engine.eventAtTime(events, 10.5), 1); assert.equal(engine.eventAtTime(events, 11.5), -1);
const page = fs.readFileSync('sight-singing/sight-singing-page.js', 'utf8');
assert(!page.includes('stage.scrollTo('), 'Follow marker must not scroll the viewport');
assert(page.includes('context.getOutputTimestamp'), 'Follow marker must use the audio clock');
const sampler = fs.readFileSync('guitar-sampler.js', 'utf8');
assert(sampler.includes('audio.preservesPitch = false'), 'File sample playback must transpose pitch');
assert(html.includes('source.midi+fr,stringMidi:source.midi'), 'Fretboard must use its actual string sample');
console.log('PASS: fixed tuner targets; 3+2 detected measures; unequal-width notehead mapping; manual fallback; audio-clock boundaries; sample wiring.');
