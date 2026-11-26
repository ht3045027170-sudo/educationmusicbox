((build) => {
  if (typeof module === 'object' && module.exports) {
    module.exports = build(require('./scales.js'), require('../chord-library/harmony.js'));
  } else window.HetianScaleInstrument = build(window.HetianScales, window.HetianChordLibrary);
})((scales, harmony) => {
  'use strict';
  const open = harmony.tuning;
  const clamp = (n, max = 24) => Math.max(0, Math.min(max, Math.floor(Number(n)) || 0));
  const coordinate = (string, fret) => ({ string, fret, midi: open[6 - string] + fret, stringMidi: open[6 - string] });
  const key = note => `${note.string}:${note.fret}`;
  const chroma = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  const noteName = midi => chroma[scales.mod(midi)] + (Math.floor(midi / 12) - 1);
  const sequence = (root, notes, octave = 3) => {
    const tonic = 12 * (octave + 1) + root.pc;
    return [...notes.map(note => tonic + note.pitch), tonic + 12];
  };
  function arpeggio(root, type) {
    return type.tones.map(tone => ({ interval: tone.interval, pc: scales.mod(root.pc + tone.pitch),
      pitch: harmony.semitones(tone.interval), name: harmony.spell(root, tone.interval),
      featured: /3|7/.test(tone.interval) })).sort((a,b) => a.pitch - b.pitch);
  }
  function material(root, type) {
    if (type.id !== '7alt') return arpeggio(root, type);
    const base = ['1','3','b7','#9','b5'];
    return arpeggio(root, type).filter(note => base.includes(note.interval));
  }

  function board(notes, from = 0, to = 24, strings = [6,5,4,3,2,1]) {
    const tones = new Map(notes.map(note => [note.pc, note]));
    const first = clamp(from), last = Math.max(first, clamp(to));
    return strings.flatMap(string => Array.from({length: last - first + 1}, (_, i) => {
      const cell = coordinate(string, first + i);
      return { ...cell, tone: tones.get(scales.mod(cell.midi)) };
    }));
  }

  function finger(fret, from, to) {
    if (!fret) return '0';
    if (to - from <= 3) return String(Math.max(1, Math.min(4, fret - Math.max(1, from) + 1)));
    if (to - from === 4) return ['1','1','2','3','4'][fret - from];
    return '';
  }

  function region(notes, from, to, label, strings) {
    from = clamp(from);
    to = Math.max(from, clamp(to));
    const cells = board(notes, from, to, strings).map(cell => ({...cell, finger: finger(cell.fret, from, to)}));
    return { label, from, to, cells };
  }

  function pentatonicBoxes(root, notes) {
    const patterns = [
      ['E', [[0,3],[0,2],[0,2],[0,2],[0,3],[0,3]]],
      ['D', [[3,5],[2,5],[2,5],[2,4],[3,5],[3,5]]],
      ['C', [[5,7],[5,7],[5,7],[4,7],[5,8],[5,7]]],
      ['A', [[7,10],[7,10],[7,9],[7,9],[8,10],[7,10]]],
      ['G', [[10,12],[10,12],[9,12],[9,12],[10,12],[10,12]]],
    ];
    const bassPc = notes.some(note => note.interval === 'b3') ? root.pc : scales.mod(root.pc + 9);
    const anchor = scales.mod(bassPc-open[0]);
    return patterns.map(([name, offsets])=>{
      let base = anchor;
      if(base + Math.max(...offsets.flat()) > 24)base -= 12;
      const frets = offsets.map(pair=>pair.map(offset=>offset+base));
      const from=Math.min(...frets.flat()), to=Math.max(...frets.flat());
      const box=region(notes,from,to,name+' 型');
      box.cells=box.cells.map(cell=>frets[6-cell.string].includes(cell.fret)?cell:{...cell,tone:undefined});
      return box;
    }).sort((a,b)=>a.from-b.from);
  }

  function caged(root, notes, reference = null) {
    const formula = notes.map(n=>n.pitch).join(',');
    if (formula === '0,3,5,7,10' || formula === '0,2,4,7,9') return pentatonicBoxes(root,notes);
    const pitch = reference?.pc ?? root.pc;
    const minor = notes.some(note => note.interval === 'b3') && !notes.some(note => note.interval === '3');
    const fixed = minor
      ? [{name:'E', string:6, left:0, width:3}, {name:'D', string:4, left:0, width:3},
        {name:'C', string:5, left:3, width:3}, {name:'A', string:5, left:0, width:3},
        {name:'G', string:6, left:2, width:3}]
      : [{name:'C', string:5, left:3, width:4}, {name:'A', string:5, left:1, width:4},
        {name:'G', string:6, left:2, width:4}, {name:'E', string:6, left:1, width:4},
        {name:'D', string:4, left:1, width:4}];
    return fixed.map(({name,string,left,width}) => {
      let from = scales.mod(pitch - open[6 - string]) - left;
      if (from < 0) from += 12;
      return region(notes, from, from + width, name + ' 型');
    }).sort((a,b) => a.from - b.from);
  }

  function perString(notes, count, anchorString = 6) {
    const first = board(notes, 0, 24, [anchorString]).filter(cell => cell.tone && cell.fret <= 12);
    return first.flatMap((start, i) => {
      let previous = start.midi - 1;
      const byString = [];
      for (let string = anchorString; string >= 1; string--) {
        const options = board(notes, 0, 24, [string]).filter(cell => cell.tone &&
          cell.midi > previous && (string !== anchorString || cell.fret >= start.fret)).slice(0, count);
        if (options.length !== count) return [];
        const lo = options[0].fret, hi = options.at(-1).fret;
        if (hi - lo > 5) return [];
        byString.push(...options.map(cell => ({...cell, finger: finger(cell.fret, lo, hi)})));
        previous = options.at(-1).midi;
      }
      const from = Math.min(...byString.map(note => note.fret)), to = Math.max(...byString.map(note => note.fret));
      const valid = new Map(byString.map(cell => [key(cell), cell]));
      return [{ label: `${i+1} · 每弦 ${count} 音`, from, to,
        cells: board([], from, to, Array.from({length: anchorString}, (_, j) => anchorString - j))
          .map(cell => valid.get(key(cell)) || cell) }];
    });
  }

  function starts(root, notes, string) {
    return board(notes, 0, 24, [string]).filter(cell => cell.tone?.pc === root.pc && cell.fret <= 19)
      .map(cell => region(notes, cell.fret, cell.fret + 4, `${string} 弦 ${cell.fret} 品主音`,
        Array.from({length:string}, (_, i) => string-i)));
  }

  function overlap(left, right) {
    const positions = new Set(right.cells.filter(cell => cell.tone).map(key));
    return left.cells.filter(cell => cell.tone && positions.has(key(cell)));
  }

  function crossRoute(left, right) {
    const bridge = overlap(left, right).sort((a,b) => a.fret - b.fret || a.string - b.string)[0];
    if (!bridge) return [];
    const approach = left.cells.filter(cell => cell.tone && cell.midi < bridge.midi && cell.string === bridge.string).slice(-2);
    const exit = right.cells.filter(cell => cell.tone && cell.midi > bridge.midi && cell.string === bridge.string).slice(0,2);
    return [...approach, bridge, ...exit];
  }

  const techniques = new Map([['','普通'],['h','击弦'],['p','勾弦'],['/','上滑'],['\\','下滑'],['b','推弦'],['~','揉弦']]);
  function parseTab(text) {
    const raw = text.trim().split(/\s+/).filter(Boolean);
    if (!raw.length || raw.length > 256) throw Error('请输入 1–256 个音或休止。');
    return raw.map((token, i) => {
      if (token === '|') return null;
      const match = /^([1-6]):(\d{1,2})(?:([hp/\\b~])(?:\((\d{1,2})\))?)?(?:@(\d+(?:\.\d+)?))?$/.exec(token);
      const rest = /^r(?:@(\d+(?:\.\d+)?))?$/.exec(token);
      if (!match && !rest) throw Error(`第 ${i+1} 格格式错误：${token}`);
      const beats = Number((rest?.[1] || match?.[5]) ?? .5);
      if (!(beats >= .125 && beats <= 16)) throw Error(`第 ${i+1} 格时值超出 0.125–16 拍。`);
      if (rest) return { rest: true, beats };
      const [,string,fret,technique = '', target] = match;
      if (+fret > 24 || (target !== undefined && +target > 24)) throw Error(`第 ${i+1} 格超过 24 品。`);
      const targetFret = target === undefined ? null : Number(target);
      if (targetFret !== null && !['h','p','/','\\','b'].includes(technique)) throw Error(`第 ${i+1} 格的技巧不接受目标品。`);
      if (targetFret !== null && (['h','/','b'].includes(technique) ? targetFret <= +fret : targetFret >= +fret)) {
        throw Error(`第 ${i+1} 格的技巧与目标方向不符。`);
      }
      return { ...coordinate(+string, +fret), beats, technique, targetFret };
    }).filter(Boolean);
  }

  function formatTab(notes) {
    return notes.map(note => note.rest ? `r@${note.beats}` :
      `${note.string}:${note.fret}${note.technique}${note.targetFret === null ? '' : `(${note.targetFret})`}@${note.beats}`).join(' ');
  }

  function relocate(notes, semitones = 0, position = 5, octave = 0) {
    const shift = Number(semitones) + Number(octave) * 12;
    let previous = null;
    return notes.map((note, i) => {
      if (note.rest) return note;
      const midi = note.midi + shift;
      const delta = note.targetFret === null ? null : note.targetFret - note.fret;
      const possible = open.map((base, j) => coordinate(6-j, midi - base))
        .filter(cell => cell.fret >= 0 && cell.fret <= 24 &&
          (delta === null || (cell.fret + delta >= 0 && cell.fret + delta <= 24)));
      if (!possible.length) throw Error(`第 ${i+1} 个音在指定音区无等音按法。可手动选择升或降一个八度。`);
      const score = cell => Math.abs(cell.fret - position) + .25 * Math.abs(cell.string - note.string) +
        (previous ? .35 * Math.abs(cell.fret - previous.fret) + .35 * Math.abs(cell.string - previous.string) : 0);
      possible.sort((a,b) => score(a) - score(b));
      previous = possible[0];
      return { ...note, ...previous, targetFret: delta === null ? null : previous.fret + delta };
    });
  }

  function review(previous, correct, now = Date.now()) {
    const entry = previous || {};
    const streak = correct ? (entry.streak || 0) + 1 : 0;
    const delays = [0,1,3,7,14,30,60];
    return { attempts: (entry.attempts || 0) + 1, correct: (entry.correct || 0) + Number(correct),
      streak, last: now, due: now + (correct ? delays[Math.min(streak, delays.length-1)] * 86400000 : 600000) };
  }

  function compatible(chord, tonic, mode) {
    const required = chord.type.tones.filter(tone => !tone.optional).map(tone => tone.pitch);
    const toneClasses = new Set(harmony.types.get(chord.type.id).tones.map(tone => tone.pitch));
    const keyScale = new Set(scales.tones(tonic, scales.byId.get(mode === 'minor' ? 'minor' : 'major')).map(tone => tone.pc));
    return scales.collection.map(scale => {
      const exact = required.every(n => scale.pitches.includes(n));
      const alt = [1,3,6,8].some(n => scale.pitches.includes(n));
      const matchesAltered = chord.type.id !== '7alt' || (alt && !scale.pitches.includes(7) && !scale.pitches.includes(2));
      const explicit = scale.chords.includes(chord.type.id);
      const fit = scale.pitches.filter(n => keyScale.has(scales.mod(chord.root.pc + n))).length / scale.pitches.length;
      const score = Number(explicit) * 4 + fit * 3 - Math.abs(scale.pitches.length - 7) * .45 +
        scale.pitches.filter(n => toneClasses.has(n)).length * .08;
      return {scale, exact: exact && matchesAltered, explicit, score, fit};
    }).filter(item => item.exact || (item.explicit && chord.type.id !== '7alt'))
      .sort((a,b) => Number(b.exact)-Number(a.exact) || b.score-a.score);
  }

  function nearestTargets(previous, chord, from, to) {
    const guideTones = material(chord.root, chord.type).filter(tone => [3,7].includes(scales.degree(tone.interval)));
    const options = board(guideTones.length ? guideTones : material(chord.root, chord.type), from, to)
      .filter(cell => cell.tone);
    const origin = previous ?? 60;
    return options.sort((a,b) => Math.abs(a.midi - origin) - Math.abs(b.midi - origin)
      || Math.abs(a.fret - from) - Math.abs(b.fret - from))[0] || null;
  }

  return { open, key, coordinate, clamp, noteName, sequence, arpeggio, material, board, region, caged, perString,
    starts, overlap, crossRoute, parseTab, formatTab, relocate, review, compatible, nearestTargets, techniques };
});
