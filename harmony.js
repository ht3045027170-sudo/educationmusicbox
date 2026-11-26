((factory) => {
  const harmony = factory();
  if (typeof module === 'object' && module.exports) module.exports = harmony;
  else window.HetianChordLibrary = harmony;
})(() => {
  'use strict';

  const tuning = [40, 45, 50, 55, 59, 64];
  const keys = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const letters = 'CDEFGAB';
  const natural = [0, 2, 4, 5, 7, 9, 11];
  const major = [0, 2, 4, 5, 7, 9, 11];
  const minor = [0, 2, 3, 5, 7, 8, 10];
  const mod = value => (value % 12 + 12) % 12;
  const ascii = value => value.replace(/♭/g, 'b').replace(/♯/g, '#');
  const music = value => value.replace(/b/g, '♭').replace(/#/g, '♯');
  const accidentals = amount => amount > 0 ? '♯'.repeat(amount) : '♭'.repeat(-amount);
  const alteration = value => [...ascii(value)].reduce((sum, char) => sum + (char === '#' ? 1 : -1), 0);
  const degree = interval => Number(interval.match(/\d+/)[0]);
  const semitones = interval => {
    const step = degree(interval) - 1;
    return natural[step % 7] + 12 * Math.floor(step / 7) + alteration(interval.replace(/\d+/, ''));
  };

  // Parentheses mark optional chord degrees. Named alterations are required.
  const families = [
    ['基础', [
      ['', '1 3 5'], ['m', '1 b3 5'], ['5', '1 5'], ['aug', '1 3 #5'],
      ['dim', '1 b3 b5'], ['maj7', '1 3 (5) 7'], ['m7', '1 b3 (5) b7'],
      ['7', '1 3 (5) b7'], ['m7b5', '1 b3 b5 b7'], ['dim7', '1 b3 b5 bb7'],
      ['m(maj7)', '1 b3 (5) 7'],
    ]],
    ['六和弦', [
      ['6', '1 3 (5) 6'], ['m6', '1 b3 (5) 6'],
      ['6/9', '1 3 (5) 6 9'], ['m6/9', '1 b3 (5) 6 9'],
    ]],
    ['九和弦', [
      ['add9', '1 3 (5) 9'], ['madd9', '1 b3 (5) 9'],
      ['maj9', '1 3 (5) 7 9'], ['m9', '1 b3 (5) b7 9'], ['9', '1 3 (5) b7 9'],
      ['7b9', '1 3 (5) b7 b9'], ['7#9', '1 3 (5) b7 #9'],
      ['maj7b9', '1 3 (5) 7 b9'], ['9b5', '1 3 b5 b7 9'], ['9#5', '1 3 #5 b7 9'],
    ]],
    ['十一和弦', [
      ['add11', '1 3 (5) 11'], ['madd11', '1 b3 (5) 11'],
      ['maj11', '1 3 (5) 7 (9) 11'], ['m11', '1 b3 (5) b7 (9) 11'],
      ['11', '1 (3) (5) b7 (9) 11'], ['maj7#11', '1 3 (5) 7 #11'],
      ['7#11', '1 3 (5) b7 #11'], ['maj9#11', '1 3 (5) 7 9 #11'],
      ['9#11', '1 3 (5) b7 9 #11'],
    ]],
    ['十三和弦', [
      ['13', '1 3 (5) b7 (9) (11) 13'], ['maj13', '1 3 (5) 7 (9) (11) 13'],
      ['m13', '1 b3 (5) b7 (9) (11) 13'], ['7b13', '1 3 (5) b7 b13'],
      ['13b9', '1 3 (5) b7 b9 (11) 13'], ['13#9', '1 3 (5) b7 #9 (11) 13'],
      ['13#11', '1 3 (5) b7 (9) #11 13'],
    ]],
    ['挂留和弦', [
      ['sus2', '1 2 5'], ['sus4', '1 4 5'], ['7sus2', '1 2 (5) b7'],
      ['7sus4', '1 4 (5) b7'], ['9sus4', '1 4 (5) b7 9'], ['13sus4', '1 4 (5) b7 (9) 13'],
    ]],
    ['变化属和弦', [
      ['7b5', '1 3 b5 b7'], ['7#5', '1 3 #5 b7'],
      ['7b5b9', '1 3 b5 b7 b9'], ['7b5#9', '1 3 b5 b7 #9'],
      ['7#5b9', '1 3 #5 b7 b9'], ['7#5#9', '1 3 #5 b7 #9'],
      ['7alt', '1 3 (b5) (#5) b7 (b9) (#9)'],
    ]],
  ];

  const toneData = formula => formula.split(' ').map(token => {
    const interval = token.replace(/[()]/g, '');
    return { interval, pitch: mod(semitones(interval)), optional: token.startsWith('(') };
  });
  const types = new Map(families.flatMap(([family, entries]) =>
    entries.map(([id, formula]) => [id, { id, family, tones: toneData(formula) }])));
  const altTones = ['b5', '#5', 'b9', '#9'];

  function readRoot(text) {
    const match = /^([A-Ga-g])([#b]*)$/.exec(ascii(text));
    if (!match) return null;
    const letter = match[1].toUpperCase();
    const offset = alteration(match[2]);
    return { letter, offset, pc: mod(natural[letters.indexOf(letter)] + offset),
      name: letter + accidentals(offset) };
  }

  function spell(root, interval) {
    const index = (letters.indexOf(root.letter) + degree(interval) - 1) % 7;
    const desired = mod(root.pc + semitones(interval));
    return letters[index] + accidentals(mod(desired - natural[index] + 6) - 6);
  }

  // A finite set of common grips, listed as fret offsets from the bass root.
  // null explicitly mutes a string. Compact jazz shells precede full barres.
  const grips = [
    {
      '': [[0,2,2,1,0,0], [0,null,null,1,0,0]],
      m: [[0,2,2,0,0,0], [0,null,null,0,0,0]],
      '5': [[0,2,2,null,null,null], [0,2,null,null,null,null]],
      maj7: [[0,null,1,1,0,null], [0,2,1,1,0,0]],
      m7: [[0,null,0,0,0,null], [0,2,0,0,0,0]],
      m11: [[0,null,0,0,-2,null], [0,null,0,0,-2,2]],
      '7': [[0,null,0,1,0,null], [0,2,0,1,0,0]],
      '6/9': [[0,null,-1,-1,0,2], [0,null,-1,-1,2,2]],
      maj9: [[0,null,1,1,0,2]],
      '11': [[0,null,0,-1,-2,null]],
      '13': [[0,null,0,1,2,null], [0,null,0,1,2,2]],
      'maj13': [[0,null,1,1,2,null], [0,null,1,1,2,2]],
      m13: [[0,null,0,0,2,null], [0,null,0,0,2,2]],
      '7b13': [[0,null,0,1,1,null]],
      '7sus4': [[0,null,0,2,0,null], [0,2,0,2,0,0]],
      '7#9': [[0,null,0,1,null,3]],
      '9sus4': [[0,null,0,-1,-2,null]],
    },
    {
      '': [[null,0,2,2,2,0], [null,0,-1,-3,-2,null]],
      m: [[null,0,2,2,1,0], [null,0,2,2,1,null]],
      '5': [[null,0,2,2,null,null], [null,0,2,null,null,null]],
      maj7: [[null,0,2,1,2,0], [null,0,-1,1,-2,null]],
      '7': [[null,0,-1,0,-2,null], [null,0,2,0,2,0]],
      m7: [[null,0,2,0,1,0], [null,0,-2,0,-2,null]],
      maj9: [[null,0,-1,1,0,null], [null,0,-1,1,0,0]],
      m9: [[null,0,-2,0,0,null], [null,0,-2,0,0,0]],
      '9': [[null,0,-1,0,0,null], [null,0,-1,0,0,0]],
      '7b9': [[null,0,-1,0,-1,null]],
      '7#9': [[null,0,-1,0,1,null]],
      '6/9': [[null,0,-1,-1,0,null], [null,0,-1,-1,0,0]],
      'm6/9': [[null,0,-2,-1,0,null], [null,0,-2,-1,0,0]],
      'm7b5': [[null,0,1,0,1,null]],
      'dim7': [[null,0,1,-1,1,null]],
      '13': [[null,0,-1,0,2,2], [null,0,-1,0,null,2]],
      '11': [[null,0,0,0,0,0], [null,0,0,0,0,null]],
      '9sus4': [[null,0,0,0,0,0]],
    },
    {
      '': [[null,null,0,2,3,2], [null,null,0,-1,-2,null]],
      m: [[null,null,0,2,3,1], [null,null,0,-2,-2,null]],
      '5': [[null,null,0,2,3,null], [null,null,0,2,null,null]],
      maj7: [[null,null,0,2,2,2]],
      m7: [[null,null,0,2,1,1]],
      '7': [[null,null,0,2,1,2]],
      '6': [[null,null,0,2,0,2]],
      m6: [[null,null,0,2,0,1]],
      sus2: [[null,null,0,2,3,0]],
      sus4: [[null,null,0,2,3,3]],
    },
  ];

  // Jazz shells, adjacent four-string grips, and common barre groups.
  // Supplement fixed grips only within these groups and a four-fret window.
  const groups = [
    ['6', '65', '654', '643', '632', '6543', '6432', '6431', '6321', '6542', '65432', '64321', '654321', '65431'],
    ['5', '54', '543', '532', '5432', '5431', '5321', '54321'],
    ['4', '43', '432', '431', '421', '4321'],
  ];

  function fingering(frets) {
    const pressed = frets.flatMap((fret, index) => fret > 0 ? [{ fret, index }] : []);
    if (!pressed.length) return { fingers: frets.map(() => null), barres: [], span: 0 };
    const min = Math.min(...pressed.map(note => note.fret));
    const max = Math.max(...pressed.map(note => note.fret));
    if (max - min > 3) return null;
    const orders = new Map();
    for (const note of pressed) {
      if (!orders.has(note.fret)) orders.set(note.fret, []);
      orders.get(note.fret).push(note.index);
    }
    const sorted = [...orders].sort((a,b) => a[0] - b[0]);
    const arrangements = [];
    function assign(i, units, bars) {
      if (units.length > 4) return;
      if (i === sorted.length) {
        arrangements.push({ units, bars });
        return;
      }
      const [fret, indices] = sorted[i];
      assign(i + 1, [...units, ...indices.map(index => [index])], bars);
      if (indices.length < 2 || bars.length >= 2) return;
      const from = indices[0], to = indices.at(-1);
      const crossing = frets.slice(from, to + 1);
      if (crossing.some(value => value >= 0 && value < fret)) return;
      if (fret !== min && (to - from > 2 || crossing.some(value => value !== fret))) return;
      assign(i + 1, [...units, indices], [...bars, { fret, from, to, unit: units.length }]);
    }
    assign(0, [], []);
    arrangements.sort((a,b) => (a.units.length + a.bars.length * 1.25) - (b.units.length + b.bars.length * 1.25));
    const best = arrangements[0];
    if (!best) return null;
    const fingers = frets.map(() => null);
    best.units.forEach((unit, i) => unit.forEach(index => { fingers[index] = i + 1; }));
    return { fingers, barres: best.bars.map(({fret, from, to, unit}) => ({fret, from, to, finger: unit + 1})), span: max - min };
  }

  function validate(root, type, rootString, frets) {
    const rootIndex = 6 - rootString;
    if (!groups[rootIndex] || !type || !root || frets.length !== 6 ||
        frets.some((fret, i) => !Number.isInteger(fret) || fret < -1 || fret > 20 || (i < rootIndex && fret !== -1))) return null;
    if (frets[rootIndex] < 0 || mod(tuning[rootIndex] + frets[rootIndex]) !== root.pc) return null;
    const notes = [];
    for (const [i, fret] of frets.entries()) {
      if (fret < 0) continue;
      const midi = tuning[i] + fret;
      if (midi < tuning[rootIndex] + frets[rootIndex]) return null;
      const interval = type.tones.find(tone => tone.pitch === mod(midi - root.pc))?.interval;
      if (!interval) return null;
      const name = spell(root, interval);
      const written = readRoot(name);
      const octave = (midi - natural[letters.indexOf(written.letter)] - written.offset) / 12 - 1;
      notes.push({ string: 6 - i, fret, midi, stringMidi: tuning[i], interval, name, octave });
    }
    const intervals = new Set(notes.map(note => note.interval));
    if (type.tones.some(tone => !tone.optional && !intervals.has(tone.interval))) return null;
    const changes = altTones.filter(interval => intervals.has(interval));
    if (type.id === '7alt' && !changes.length) return null;
    // A thirdless dominant 11 must keep the 9. With neither, it is only 7sus4.
    const thirdlessEleventh = type.id === '11' && !intervals.has('3');
    if (thirdlessEleventh && !intervals.has('9')) return null;
    const position = fingering(frets);
    if (!position) return null;
    const omitted = type.tones.filter(tone => !intervals.has(tone.interval) &&
      (type.id !== '7alt' || !altTones.includes(tone.interval))).map(tone => tone.interval);
    return { frets, notes, rootString, changes, omitted, thirdlessEleventh, ...position };
  }

  function gripScore(shape) {
    const open = shape.frets.includes(0);
    const frets = shape.frets.filter(fret => fret >= 0);
    const closeThird = shape.notes.some(third => third.interval === '3' && shape.notes.some(eleven =>
      eleven.interval === '11' && Math.abs(eleven.midi - third.midi) <= 2));
    return (closeThird ? 3 : 0) + (open ? 6 : 0) + shape.span * 1.9 + shape.barres.length * .8
      + Math.max(...shape.fingers) * .65 + Math.min(...frets) * .26
      + shape.omitted.filter(interval => interval !== '5').length * 1.2
      - new Set(shape.notes.map(note => note.interval)).size * .55;
  }

  const cache = new Map();
  function voicings(root, type, rootString) {
    const rootIndex = 6 - rootString;
    if (!groups[rootIndex]) return [];
    const lookup = [root.name, type.id, rootString].join(':');
    if (cache.has(lookup)) return cache.get(lookup);
    const found = new Map();
    function add(frets, chart = false) {
      const pattern = frets.join(',');
      if (found.has(pattern)) return;
      const shape = validate(root, type, rootString, frets);
      if (!shape) return;
      found.set(pattern, { ...shape, chart, id: [root.pc, type.id, rootString, pattern].join(':'),
        score: gripScore(shape) - (chart ? 9 : 0) });
    }
    const bass = mod(root.pc - tuning[rootIndex]);
    for (let anchor = bass; anchor <= 16; anchor += 12) {
      for (const offsets of grips[rootIndex][type.id] || []) {
        const frets = offsets.map(offset => offset === null ? -1 : anchor + offset);
        if (offsets.every((offset, i) => offset === null || frets[i] >= 0)) add(frets, true);
      }
      for (const group of groups[rootIndex]) {
        if (group.length < type.tones.filter(tone => !tone.optional).length) continue;
        const strings = [...group].slice(1).map(string => 6 - Number(string));
        for (let start = Math.max(0, anchor - 3); start <= anchor; start++) {
          const frets = [-1, -1, -1, -1, -1, -1];
          frets[rootIndex] = anchor;
          function fill(i) {
            if (i === strings.length) { add(frets.slice()); return; }
            const index = strings[i];
            for (let fret = start; fret <= start + 3; fret++) {
              if (!type.tones.some(tone => tone.pitch === mod(tuning[index] + fret - root.pc))) continue;
              frets[index] = fret;
              fill(i + 1);
            }
          }
          fill(0);
        }
      }
    }
    const ranked = [...found.values()].sort((a,b) => a.score - b.score);
    const selected = [];
    const seen = new Set();
    for (const shape of ranked) {
      const anchor = shape.frets[rootIndex];
      const signature = shape.frets.map(fret => fret < 0 ? 'x' : fret - anchor).join(',');
      if (seen.has(signature)) continue;
      seen.add(signature);
      selected.push(shape);
      if (selected.length === 3) break;
    }
    const result = selected.sort((a,b) => Number(a.frets.includes(0)) - Number(b.frets.includes(0)));
    cache.set(lookup, result);
    return result;
  }

  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const diatonic = {
    major: ['', 'm', 'm', '', '', 'm', 'dim'],
    minor: ['m', 'dim', '', 'm', 'm', '', ''],
  };
  const aliases = new Map([
    ['Major', ''], ['major', ''], ['Minor', 'm'], ['minor', 'm'], ['min', 'm'],
    ['M7', 'maj7'], ['M9', 'maj9'], ['M11', 'maj11'], ['M13', 'maj13'],
    ['△7', 'maj7'], ['△9', 'maj9'], ['△11', 'maj11'], ['△13', 'maj13'],
    ['min7', 'm7'], ['min9', 'm9'], ['mMaj7', 'm(maj7)'], ['mmaj7', 'm(maj7)'],
    ['ø', 'm7b5'], ['ø7', 'm7b5'], ['°', 'dim'], ['°7', 'dim7'], ['+', 'aug'],
    ['sus', 'sus4'],
  ]);
  function readSuffix(value) {
    const clean = ascii(value).replace(/[,，]/g, '').replace(/\(([b#].*)\)/g, '$1');
    return aliases.get(clean) ?? (types.has(clean) ? clean : null);
  }
  const suffixLabel = id => music(id);
  function rootAt(tonic, mode, step, shift = 0) {
    const index = (letters.indexOf(tonic.letter) + step) % 7;
    const scale = mode === 'minor' ? minor : major;
    const diff = mod(tonic.pc + scale[step] - natural[index] + 6) - 6 + shift;
    return readRoot(letters[index] + accidentals(diff));
  }
  function relativeRoot(tonic, mode, root) {
    const step = (letters.indexOf(root.letter) - letters.indexOf(tonic.letter) + 7) % 7;
    const shift = root.offset - rootAt(tonic, mode, step).offset;
    return { step, shift };
  }

  function readToken(token, tonic, mode, inputMode) {
    const value = ascii(token);
    const numeric = /^([#b]*)([1-7])(.*)$/.exec(value);
    const roman = /^([#b]*)(vii|iii|vi|iv|ii|v|i)(.*)$/i.exec(value);
    const absolute = /^([A-Ga-g])([#b]*)(.*)$/.exec(value);
    if (numeric && inputMode !== 'roman' && inputMode !== 'absolute') {
      const [, shifts, number, raw] = numeric;
      const step = Number(number) - 1;
      const id = raw ? readSuffix(raw) : diatonic[mode][step];
      if (id !== null) return { step, shift: alteration(shifts), id, implicit: !raw };
    }
    if (roman && inputMode !== 'numeric' && inputMode !== 'absolute') {
      const [, shifts, numeral, raw] = roman;
      const step = romans.indexOf(numeral.toUpperCase());
      const lower = numeral === numeral.toLowerCase();
      const lowerSuffix = lower ? readSuffix('m' + raw) : null;
      const id = lowerSuffix ?? readSuffix(raw);
      if (id !== null) return { step, shift: alteration(shifts), id };
    }
    if (absolute && inputMode !== 'numeric' && inputMode !== 'roman') {
      const [, letter, shifts, raw] = absolute;
      const root = readRoot(letter + shifts);
      const id = readSuffix(raw);
      if (id !== null) return { ...relativeRoot(tonic, mode, root), id };
    }
    return null;
  }

  function parse(input, tonic, mode = 'major', inputMode = 'auto') {
    const trimmed = input.trim();
    if (!trimmed) throw Error('请输入和弦进行。');
    const tokens = trimmed.split(/[\s|—–→-]+/).filter(Boolean);
    const compact = tokens.length === 1 && /^[1-7]{2,}$/.test(tokens[0]) &&
      !readToken(tokens[0], tonic, mode, inputMode);
    const source = compact && ['auto', 'numeric'].includes(inputMode) ? [...tokens[0]] : tokens;
    if (!source.length || source.length > 32) throw Error('每次请输入 1–32 个和弦。');
    return source.map((token, index) => {
      const item = readToken(token, tonic, mode, inputMode);
      if (!item) throw Error(`第 ${index + 1} 个和弦“${token}”无法识别。`);
      return item;
    });
  }

  function resolve(item, tonic, mode) {
    const {step, shift} = item;
    const id = item.implicit ? diatonic[mode][step] : item.id;
    const root = rootAt(tonic, mode, step, shift);
    const accidental = accidentals(shift);
    const usesLower = id === 'm' || /^m(?!aj)/.test(id);
    const romanSuffix = id === 'dim' ? '°' : id === 'dim7' ? '°7' : suffixLabel(usesLower ? id.slice(1) : id);
    const numeral = usesLower || id.startsWith('dim') ? romans[step].toLowerCase() : romans[step];
    const numericSuffix = id ? suffixLabel(id) : diatonic[mode][step] ? 'Major' : '';
    return { ...item, id, root, type: types.get(id), name: root.name + suffixLabel(id),
      numeric: accidental + (step + 1) + numericSuffix, roman: accidental + numeral + romanSuffix };
  }

  const presets = [
    { name: '大调 251', mode: 'major', source: '2m7 57 1maj7' },
    { name: '小调 251', mode: 'minor', source: '2m7♭5 57♭9 1m(maj7)' },
    { name: '4536251', mode: 'major', source: '4536251' },
    { name: '1645', mode: 'major', source: '1645' },
    { name: '12 小节 Blues', mode: 'major', source: '17 17 17 17 | 47 47 17 17 | 57 47 17 57' },
    { name: 'Jazz Blues', mode: 'major', source: '19 49 19 1m7 | 49 ♯4dim7 19 67♭9 | 2m7 513 19 57' },
    { name: 'Neo Soul', mode: 'major', source: '1maj9 ♯1dim7 2m9 513 | 3m9 67♭9 2m9 1maj9' },
  ];

  function connection(previous, next) {
    if (!previous || !next) return 0;
    const left = previous.notes.map(note => note.midi).sort((a,b) => a - b);
    const right = next.notes.map(note => note.midi).sort((a,b) => a - b);
    const costs = Array.from({length: left.length + 1}, (_, i) =>
      Array.from({length: right.length + 1}, (_, j) => (i + j) * 5));
    for (let i = 1; i <= left.length; i++) for (let j = 1; j <= right.length; j++) {
      costs[i][j] = Math.min(costs[i-1][j] + 5, costs[i][j-1] + 5,
        costs[i-1][j-1] + Math.abs(left[i-1] - right[j-1]));
    }
    const position = shape => Math.min(...shape.frets.filter(fret => fret >= 0));
    const bass = Math.abs(previous.notes[0].midi - next.notes[0].midi);
    const top = Math.abs(left.at(-1) - right.at(-1));
    return costs[left.length][right.length] + 2 * Math.abs(position(previous) - position(next)) + .25 * bass + .5 * top;
  }

  return { tuning, keys, families, types, voicings, validate, semitones, readRoot, spell,
    suffixLabel, parse, resolve, presets, connection };
});
