'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('../chord-library/harmony.js');

const expected = [
  '', 'm', '5', 'aug', 'dim', 'maj7', 'm7', '7', 'm7b5', 'dim7', 'm(maj7)',
  '6', 'm6', '6/9', 'm6/9', 'add9', 'madd9', 'maj9', 'm9', '9', '7b9', '7#9',
  'maj7b9', '9b5', '9#5', 'add11', 'madd11', 'maj11', 'm11', '11', 'maj7#11',
  '7#11', 'maj9#11', '9#11', '13', 'maj13', 'm13', '7b13', '13b9', '13#9',
  '13#11', 'sus2', 'sus4', '7sus2', '7sus4', '9sus4', '13sus4', '7b5', '7#5',
  '7b5b9', '7b5#9', '7#5b9', '7#5#9', '7alt',
];
const pitch = {
  '1': 0, '2': 2, 'b3': 3, '3': 4, '4': 5, 'b5': 6, '5': 7, '#5': 8, '6': 9,
  'bb7': 9, 'b7': 10, '7': 11, 'b9': 1, '9': 2, '#9': 3, '11': 5, '#11': 6,
  'b13': 8, '13': 9,
};
const letterPitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const open = [40, 45, 50, 55, 59, 64];
const allIds = new Set();
const counts = {4: 0, 5: 0, 6: 0};
let empty = 0, chart = 0;
assert.deepEqual([...h.types.keys()], expected);
assert.deepEqual(h.tuning, open);

for (const [pc, key] of h.keys.entries()) {
  const root = h.readRoot(key);
  assert.equal(root.pc, pc);
  for (const type of h.types.values()) {
    let allStrings = 0;
    for (const string of [6, 5, 4]) {
      const rootIndex = 6 - string;
      const shapes = h.voicings(root, type, string);
      assert.ok(shapes.length <= 3);
      allStrings += shapes.length;
      counts[string] += shapes.length;
      if (!shapes.length) empty++;
      for (const shape of shapes) {
        if (shape.chart) chart++;
        assert.ok(!allIds.has(shape.id), shape.id);
        allIds.add(shape.id);
        assert.equal(shape.notes[0].string, string);
        assert.equal(shape.notes[0].interval, '1');
        assert.ok(shape.frets.slice(0, rootIndex).every(fret => fret === -1));
        const pressed = shape.frets.filter(fret => fret > 0);
        assert.ok(Math.max(...pressed) - Math.min(...pressed) <= 3);
        const used = new Set();
        let sounded = 0;
        shape.frets.forEach((fret, index) => {
          const finger = shape.fingers[index];
          if (fret <= 0) assert.equal(finger, null);
          if (fret < 0) return;
          const note = shape.notes[sounded++];
          const midi = open[index] + fret;
          const accidental = [...note.name.slice(1)].reduce((total, char) => total + (char === '♯' ? 1 : -1), 0);
          assert.equal(note.string, 6 - index);
          assert.equal(note.fret, fret);
          assert.equal(note.midi, midi);
          assert.equal(note.stringMidi, open[index]);
          assert.equal(midi, (note.octave + 1) * 12 + letterPitch[note.name[0]] + accidental);
          assert.equal(midi % 12, (pc + pitch[note.interval]) % 12);
          assert.ok(midi >= shape.notes[0].midi);
          assert.ok(type.tones.some(tone => tone.interval === note.interval));
          used.add(note.interval);
          if (fret > 0) assert.ok(finger >= 1 && finger <= 4);
          if (fret > 0 && shape.fingers.indexOf(finger) < index) {
            assert.ok(shape.barres.some(barre => barre.finger === finger &&
              barre.fret === fret && barre.from <= index && barre.to >= index));
          }
        });
        assert.equal(shape.notes.length, sounded);
        for (const tone of type.tones) {
          if (!tone.optional) assert.ok(used.has(tone.interval), shape.id);
          else if (!used.has(tone.interval) && type.id !== '7alt') assert.ok(shape.omitted.includes(tone.interval));
        }
        if (type.id === '7alt') assert.deepEqual(shape.changes, ['b5','#5','b9','#9'].filter(interval => used.has(interval)));
        for (const { from, to, fret, finger } of shape.barres) {
          assert.ok(from < to);
          assert.equal(shape.fingers[from], finger);
          assert.equal(shape.fingers[to], finger);
          assert.ok(!shape.frets.slice(from, to + 1).some(value => value >= 0 && value < fret));
        }
      }
    }
    assert.ok(allStrings >= 2, `${root.name}${type.id} has ${allStrings} shapes`);
  }
}

const C = h.readRoot('C');
const Dflat = h.readRoot('D♭');
const read = (source, mode = 'major') => h.parse(source, C, mode);
const names = (source, mode = 'major') => read(source, mode).map(item => h.resolve(item, C, mode).name);
assert.deepEqual(names('37 3m7 57♭9 57♯9 67 46/9 2m9 1maj9'),
  ['E7','Em7','G7♭9','G7♯9','A7','F6/9','Dm9','Cmaj9']);
assert.deepEqual(names('4536251'), ['F','G','Em','Am','Dm','G','C']);
assert.deepEqual(names('1645'), ['C','Am','F','G']);
assert.deepEqual(names('251'), ['Dm','G','C']);
assert.deepEqual(names('513'), ['G13']);
assert.deepEqual(names('5 1 3'), ['G','C','Em']);
assert.deepEqual(names('4maj9 – 513 – 3m9 – 6m9 – 2m9 – 57♭9 – 1maj9'),
  ['Fmaj9','G13','Em9','Am9','Dm9','G7♭9','Cmaj9']);
assert.deepEqual(names('iiø7 V7(b9) i(maj7)', 'minor'), ['Dm7♭5','G7♭9','Cm(maj7)']);
assert.deepEqual(names('Gm(maj7) B♭7(♯5,♭9) E♭6/9'), ['Gm(maj7)','B♭7♯5♭9','E♭6/9']);
assert.deepEqual(read('ii7 V7 Imaj7').map(item => h.resolve(item, Dflat, 'major').name), ['E♭m7','A♭7','D♭maj7']);
assert.deepEqual(read('251').map(item => h.resolve(item, C, 'minor').name), ['Ddim','Gm','Cm']);
assert.deepEqual(read('F♯7 G7').map(item => h.resolve(item, Dflat, 'major').name), ['G7','A♭7']);
assert.equal(h.spell(C, '#9'), 'D♯');
assert.equal(h.spell(h.readRoot('F♯'), '#11'), 'B♯');
assert.equal(h.spell(h.readRoot('B♭'), 'bb7'), 'A♭♭');
assert.throws(() => read('C7 nonsense'));
assert.throws(() => h.parse('V7', C, 'major', 'numeric'));
assert.equal(h.voicings(C, h.types.get('13b9'), 4).length, 0);
const thirdless = [8,-1,8,7,6,-1];
const eleventh = h.validate(C, h.types.get('11'), 6, thirdless);
const suspended = h.validate(C, h.types.get('9sus4'), 6, thirdless);
assert.ok(eleventh.thirdlessEleventh);
assert.ok(eleventh.omitted.includes('3'));
assert.deepEqual(eleventh.notes.map(note => note.midi), suspended.notes.map(note => note.midi));
assert.equal(h.validate(C, h.types.get('11'), 6, [8,-1,8,-1,6,-1]), null);
assert.equal(h.validate(C, h.types.get('maj11'), 6, thirdless), null);
const standard13 = h.validate(h.readRoot('G'), h.types.get('13'), 6, [3,-1,3,4,5,-1]);
assert.deepEqual(standard13.omitted, ['5','9','11']);
assert.ok(h.validate(C, h.types.get('maj9'), 6, [8,-1,9,9,8,10]));
assert.equal(h.validate(C, h.types.get('9'), 6, [8,-1,9,9,8,10]), null);
assert.equal(h.validate(C, h.types.get('7alt'), 6, [8,-1,8,9,8,-1]), null);
assert.equal(h.validate(C, h.types.get('add9'), 6, [8,-1,8,9,8,10]), null);
for (const preset of h.presets) {
  const items = read(preset.source, preset.mode);
  const options = items.map(item => {
    const chord = h.resolve(item, C, preset.mode);
    return h.voicings(chord.root, chord.type, 6)[0];
  });
  assert.ok(options.every(Boolean), preset.name);
  assert.ok(h.connection(options[0], options[1]) >= 0);
  assert.equal(h.connection(options[0], options[0]), 0);
}

const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(index.indexOf('guitar-sampler.js') < index.indexOf('chord-library/harmony.js'));
assert.ok(index.indexOf('chord-library/harmony.js') < index.indexOf('chord-library/page.js'));
assert.match(index, /data-page="chordFinder"/);
assert.match(index, /id="fretboard"/);
assert.match(index, /id="chordPiano"/);

console.log(`Validated ${h.types.size} chord types × ${h.keys.length} roots × 3 strings.`);
console.log(`${allIds.size} voicings (${chart} from reference grips); ${empty} combinations have no supported grip.`);
console.log('Voicings by root string:', counts);
