(() => {
  'use strict';
  const NS = window.MusicScore = window.MusicScore || {};
  const SVG = 'http://www.w3.org/2000/svg';
  const create = (tag, attrs = {}, text = '') => {
    const node = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const DIATONIC_LETTER = [0,0,1,1,2,3,3,4,4,5,5,6];
  const NATURAL_PITCH_CLASS = [0,2,4,5,7,9,11];
  function diatonicStep(midi) {
    const value = Math.max(0, Math.min(127, Math.round(midi)));
    return (Math.floor(value / 12) - 1) * 7 + DIATONIC_LETTER[value % 12];
  }
  function pitchY(midi, clef, top) {
    const center = clef === 'bass' ? 50 : 71;
    return top + 18 - (diatonicStep(midi) - diatonicStep(center)) * 4.5;
  }
  function staffYToMidi(y, clef, top) {
    const center = clef === 'bass' ? 50 : 71;
    const target = diatonicStep(center) + Math.round((top + 18 - y) / 4.5);
    const letter = ((target % 7) + 7) % 7;
    const octave = Math.floor(target / 7);
    return Math.max(0, Math.min(127, (octave + 1) * 12 + NATURAL_PITCH_CLASS[letter]));
  }
  function keySignaturePitches(key, clef) {
    const trebleSharps = [78,73,80,75,70,77,72], trebleFlats = [70,75,68,73,66,71,64];
    const bassSharps = [54,49,56,51,46,53,48], bassFlats = [46,51,44,49,42,47,40];
    const sharpCount = {G:1,D:2,A:3,E:4,B:5,'F♯':6,'C♯':7}[key] || 0;
    const flatCount = {F:1,'B♭':2,'E♭':3,'A♭':4,'D♭':5,'G♭':6,'C♭':7}[key] || 0;
    const source = clef === 'bass' ? (sharpCount ? bassSharps : bassFlats) : (sharpCount ? trebleSharps : trebleFlats);
    return { symbol: sharpCount ? '♯' : flatCount ? '♭' : '', pitches: source.slice(0, sharpCount || flatCount) };
  }
  function renderStaff(svg, score, part, options) {
    const { selectedEventId, onSelect, onMeasureClick, onMeasureHover, onMeasureLeave, width } = options;
    const snapStep = Math.max(.0625, +options.snapStep || .25);
    const accidentalMode = options.accidental || '';
    const measureW = Math.max(150, Math.min(230, (width - 105) / Math.max(1, score.settings.measuresPerSystem || 4)));
    const perSystem = Math.max(1, Math.floor((width - 105) / measureW));
    const systemH = part.showTab || part.showNumbered ? 185 : 128;
    const rows = Math.ceil(score.measures.length / perSystem);
    svg.setAttribute('viewBox', `0 0 ${width} ${rows * systemH + 80}`);
    svg.setAttribute('height', rows * systemH + 80);
    svg.innerHTML = '';
    svg.appendChild(create('text', { x: 28, y: 28, class: 'score-part-label' }, part.name));
    score.measures.forEach((measure, index) => {
      const row = Math.floor(index / perSystem), column = index % perSystem;
      const x = 92 + column * measureW, top = 42 + row * systemH;
      const group = create('g', { class: 'score-measure', 'data-measure-id': measure.id, tabindex: '0' });
      group.appendChild(create('rect', { x, y: top - 20, width: measureW, height: 76, fill: 'transparent', class: 'score-hit-area' }));
      for (let line = 0; line < 5; line++) group.appendChild(create('line', { x1: x, y1: top + line * 9, x2: x + measureW, y2: top + line * 9 }));
      group.appendChild(create('line', { x1: x, y1: top, x2: x, y2: top + 36, class: 'barline' }));
      group.appendChild(create('line', { x1: x + measureW, y1: top, x2: x + measureW, y2: top + 36, class: 'barline' }));
      group.appendChild(create('text', { x: x + 5, y: top - 9, class: 'measure-number' }, String(index + 1)));
      if (column === 0) group.appendChild(create('text', { x: x - 34, y: top + 34, class: 'score-clef' }, part.clef === 'bass' ? '𝄢' : part.clef === 'percussion' ? '𝄥' : '𝄞'));
      if (index === 0) {
        const meter = measure.timeSignature || { numerator: 4, denominator: 4 };
        const signature = keySignaturePitches(score.settings.key || 'C', part.clef);
        signature.pitches.forEach((midi, accidentalIndex) => group.appendChild(create('text', { x: x - 5 + accidentalIndex * 11, y: pitchY(midi, part.clef, top) + 6, class: 'key-signature' }, signature.symbol)));
        const meterX = x + 14 + signature.pitches.length * 10;
        group.appendChild(create('text', { x: meterX, y: top + 14, class: 'score-meter' }, meter.numerator));
        group.appendChild(create('text', { x: meterX, y: top + 32, class: 'score-meter' }, meter.denominator));
      }
      const chordArea = (measure.chordSymbols || []).filter(item => !item.partId || item.partId === part.id);
      chordArea.forEach(chord => group.appendChild(create('text', { x: x + 36 + chord.start * (measureW - 45) / 4, y: top - 13, class: 'score-chord' }, chord.text)));
      (measure.harmonyFunctions || []).filter(item => !item.partId || item.partId === part.id).forEach(item => group.appendChild(create('text', { x: x + 36 + item.start * (measureW - 45) / 4, y: top + 57, class: 'score-function' }, item.text)));
      (measure.voices || []).forEach((voice, voiceIndex) => voice.filter(event => !event.partId || event.partId === part.id).forEach(event => {
        const px = x + 38 + event.start * (measureW - 46) / (measure.timeSignature?.numerator || 4);
        if (event.type === 'rest') {
          const rest = create('text', { x: px - 7, y: top + 23, class: `score-event score-rest ${event.id === selectedEventId ? 'selected' : ''}`, 'data-event-id': event.id }, event.duration >= 2 ? '𝄼' : event.duration >= 1 ? '𝄽' : '𝄾');
          group.appendChild(rest);
        } else {
          const py = pitchY(event.midi, part.clef, top);
          for (let ledger = top - 9; py < ledger; ledger -= 9) group.appendChild(create('line', { x1: px - 9, y1: ledger, x2: px + 9, y2: ledger, class: 'ledger' }));
          for (let ledger = top + 45; py > ledger; ledger += 9) group.appendChild(create('line', { x1: px - 9, y1: ledger, x2: px + 9, y2: ledger, class: 'ledger' }));
          const accidental = {sharp:'♯',flat:'♭',natural:'♮'}[event.accidental] || ([1,3,6,8,10].includes(event.midi % 12) ? '♯' : '');
          if (accidental) group.appendChild(create('text', { x: px - 19, y: py + 5, class: 'accidental' }, accidental));
          const note = create('g', { class: `score-event score-note ${event.id === selectedEventId ? 'selected' : ''}`, 'data-event-id': event.id });
          note.appendChild(create('ellipse', { cx: px, cy: py, rx: 6.5, ry: 4.6, transform: `rotate(-18 ${px} ${py})`, class: event.duration >= 2 ? 'open' : 'filled' }));
          if (event.duration < 4) note.appendChild(create('line', { x1: px + 5, y1: py, x2: px + 5, y2: py - (voiceIndex % 2 ? -29 : 29), class: 'stem' }));
          if (event.duration <= .5) note.appendChild(create('path', { d: `M ${px+5} ${py-29} q 15 8 5 18`, class: 'flag' }));
          group.appendChild(note);
          if (event.lyric) group.appendChild(create('text', { x: px, y: top + 74, class: 'score-lyric', 'text-anchor': 'middle' }, event.lyric));
        }
      }));
      const preview = create('g', { class: 'score-note-preview', visibility: 'hidden', 'pointer-events': 'none' });
      const previewAccidental = create('text', { class: 'accidental preview-accidental', 'text-anchor': 'middle' });
      const previewHead = create('ellipse', { rx: 6.5, ry: 4.6, class: 'filled preview-head' });
      const previewStem = create('line', { class: 'stem preview-stem' });
      preview.appendChild(previewAccidental); preview.appendChild(previewHead); preview.appendChild(previewStem); group.appendChild(preview);
      const locatePointer = event => {
        const rect = svg.getBoundingClientRect();
        const svgX = (event.clientX - rect.left) * width / rect.width;
        const svgY = (event.clientY - rect.top) * (+svg.getAttribute('height')) / rect.height;
        const beats = measure.timeSignature?.numerator || 4;
        const rawStart = (svgX - x - 38) / (measureW - 46) * beats;
        const start = Math.max(0, Math.min(beats - snapStep, Math.round(rawStart / snapStep) * snapStep));
        const naturalMidi = staffYToMidi(svgY, part.clef, top);
        const offset = accidentalMode === 'sharp' ? 1 : accidentalMode === 'flat' ? -1 : 0;
        const midi = Math.max(0, Math.min(127, naturalMidi + offset));
        return { start, midi, px: x + 38 + start * (measureW - 46) / beats, py: pitchY(midi, part.clef, top) };
      };
      group.addEventListener('pointermove', event => {
        if (event.target.closest?.('[data-event-id]')) { preview.setAttribute('visibility', 'hidden'); return; }
        const position = locatePointer(event);
        preview.setAttribute('visibility', 'visible');
        previewHead.setAttribute('cx', position.px); previewHead.setAttribute('cy', position.py);
        previewHead.setAttribute('transform', `rotate(-18 ${position.px} ${position.py})`);
        previewStem.setAttribute('x1', position.px + 5); previewStem.setAttribute('y1', position.py);
        previewStem.setAttribute('x2', position.px + 5); previewStem.setAttribute('y2', position.py - 29);
        previewAccidental.textContent = {sharp:'♯',flat:'♭',natural:'♮'}[accidentalMode] || '';
        previewAccidental.setAttribute('x', position.px - 17); previewAccidental.setAttribute('y', position.py + 5);
        onMeasureHover?.(measure.id, position.start, position.midi, part.id);
      });
      group.addEventListener('pointerleave', () => { preview.setAttribute('visibility', 'hidden'); onMeasureLeave?.(); });
      group.addEventListener('click', event => {
        const eventNode = event.target.closest?.('[data-event-id]');
        if (eventNode) onSelect(eventNode.getAttribute('data-event-id'));
        else {
          const position = locatePointer(event);
          onMeasureClick(measure.id, position.start, position.midi);
        }
      });
      svg.appendChild(group);
      if (part.showNumbered) renderNumbered(svg, measure, x, top + 93, measureW, score.settings.key, part);
      if (part.showTab) renderTab(svg, measure, x, top + (part.showNumbered ? 133 : 82), measureW, part);
    });
  }
  function renderNumbered(svg, measure, x, y, width, _key, part) {
    svg.appendChild(create('text', { x: x - 48, y: y, class: 'notation-label' }, '简谱'));
    (measure.voices?.[0] || []).filter(event => !event.partId || event.partId === part.id).forEach(event => {
      const px = x + 38 + event.start * (width - 46) / (measure.timeSignature?.numerator || 4);
      if (event.type === 'rest') svg.appendChild(create('text', { x: px, y, class: 'numbered-note' }, '0'));
      else {
        const degree = [1,0,2,0,3,4,0,5,0,6,0,7][event.midi % 12] || '♯';
        const text = create('text', { x: px, y, class: 'numbered-note', 'text-anchor': 'middle' }, degree);
        svg.appendChild(text);
        if (event.duration <= .5) svg.appendChild(create('line', { x1: px - 7, y1: y + 5, x2: px + 7, y2: y + 5, class: 'number-line' }));
      }
    });
    svg.appendChild(create('line', { x1: x, y1: y + 8, x2: x + width, y2: y + 8, class: 'number-baseline' }));
  }
  function renderTab(svg, measure, x, y, width, part) {
    const strings = part.tuning?.length || 6;
    svg.appendChild(create('text', { x: x - 44, y: y + 17, class: 'notation-label' }, `${strings}线谱`));
    for (let line = 0; line < strings; line++) svg.appendChild(create('line', { x1: x, y1: y + line * 7, x2: x + width, y2: y + line * 7, class: 'tab-line' }));
    (measure.voices?.[0] || []).filter(event => event.type === 'note' && (!event.partId || event.partId === part.id)).forEach(event => {
      let tab = event.tab;
      if (!tab) {
        let best = null;
        part.tuning.forEach((open, index) => {
          const fret = event.midi - open;
          if (fret >= 0 && fret <= 24 && (!best || fret < best.fret)) best = { string: index + 1, fret };
        });
        tab = best || { string: 1, fret: 0 };
      }
      const px = x + 38 + event.start * (width - 46) / (measure.timeSignature?.numerator || 4);
      svg.appendChild(create('rect', { x: px - 7, y: y + (strings - tab.string) * 7 - 6, width: 15, height: 11, class: 'tab-number-bg' }));
      svg.appendChild(create('text', { x: px, y: y + (strings - tab.string) * 7 + 3, class: 'tab-number', 'text-anchor': 'middle' }, tab.fret));
    });
  }
  function scoreToSvgText(svg) {
    const clone = svg.cloneNode(true); clone.setAttribute('xmlns', SVG);
    return new XMLSerializer().serializeToString(clone);
  }
  NS.renderers = { renderStaff, renderNumbered, renderTab, scoreToSvgText, esc };
})();
