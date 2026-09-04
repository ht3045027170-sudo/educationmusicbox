(() => {
  'use strict';
  const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
  function clusters(values, distance = 2) {
    const groups = [];
    values.forEach(value => {
      const last = groups.at(-1);
      if (last && value - last.at(-1) <= distance) last.push(value);
      else groups.push([value]);
    });
    return groups;
  }
  function inkAt(image, x, y) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return false;
    const at = (y * image.width + x) * 4, d = image.data;
    return d[at + 3] > 100 && d[at] + d[at + 1] + d[at + 2] < 480;
  }

  // Local image geometry, not new pitch recognition. The checked score remains authoritative.
  function detect(image) {
    const { width, height } = image, candidates = [], stride = Math.max(1, Math.floor(width / 900));
    for (let y = 0; y < height; y++) {
      let dark = 0;
      for (let x = 0; x < width; x += stride) if (inkAt(image, x, y)) dark++;
      if (dark > width / stride * .30) candidates.push(y);
    }
    const lines = clusters(candidates).map(mean), rows = [];
    for (let i = 0; i <= lines.length - 5; i++) {
      const five = lines.slice(i, i + 5), gaps = five.slice(1).map((y, j) => y - five[j]);
      const gap = mean(gaps);
      if (gap < 3 || gap > 70 || !gaps.every(g => Math.abs(g - gap) <= Math.max(1.5, gap * .22))) continue;
      if (rows.length && five[0] < rows.at(-1).bottom + gap * 2) continue;
      const columns = [];
      for (let x = 0; x < width; x++) {
        if (five.filter(y => [-1, 0, 1].some(dy => inkAt(image, x, y + dy))).length >= 4) columns.push(x);
      }
      // Ignore detached text; find the longest horizontally continuous staff span.
      const span = clusters(columns, Math.max(3, gap)).sort((a, b) => b.length - a.length)[0];
      if (!span || span.at(-1) - span[0] < width * .25) continue;
      const left = span[0], right = span.at(-1), top = five[0], bottom = five[4], bars = [];
      for (let x = left + 2; x < right - 2; x++) {
        let hits = 0, count = 0;
        for (let y = Math.ceil(top); y <= bottom; y++) {
          if (five.some(line => Math.abs(y - line) < 1.5)) continue;
          count++;
          if (inkAt(image, x, y) || inkAt(image, x + 1, y)) hits++;
        }
        if (count && hits / count >= .93) bars.push(x);
      }
      const internal = clusters(bars, Math.max(2, gap * .55)).map(mean)
        .filter(x => x > left + gap * 4 && x < right - gap * 1.2);
      const boundaries = [left];
      internal.forEach(x => { if (x - boundaries.at(-1) >= gap * 4) boundaries.push(x); });
      if (right - boundaries.at(-1) < gap * 4 && boundaries.length > 1) boundaries.pop();
      boundaries.push(right);
      rows.push({ top, bottom, gap, left, right, measures: boundaries.slice(1).map((x, j) => ({ left: boundaries[j], right: x })) });
      i += 4;
    }
    return { version: 1, width, height, rows, measureCount: rows.reduce((n, row) => n + row.measures.length, 0) };
  }

  function noteY(note, staff, clef) {
    if (note.rest) return (staff.top + staff.bottom) / 2;
    const reference = clef === 'bass' ? 18 : clef === 'alto' ? 24 : 30;
    const diatonic = Number(note.octave) * 7 + 'CDEFGAB'.indexOf(note.name);
    return staff.bottom - (diatonic - reference) * staff.gap / 2;
  }
  const beats = note => Number(note.duration || 1) * (note.dotted ? 1.5 : 1) * (note.triplet ? 2 / 3 : 1);
  function headCandidates(image, row, box, y) {
    if (!image) return [];
    const columns = [], radius = Math.max(2, row.gap * .45);
    for (let x = Math.ceil(box.left + row.gap); x <= box.right - row.gap; x++) {
      let dark = 0, count = 0;
      for (let yy = Math.floor(y - radius); yy <= y + radius; yy++) {
        if ([0, 1, 2, 3, 4].some(line => Math.abs(yy - row.top - line * row.gap) <= 1.4)) continue;
        count++;
        if (inkAt(image, x, yy)) dark++;
      }
      if (count && dark / count >= .25) columns.push(x);
    }
    return clusters(columns, 1).filter(g => g.length >= row.gap * .55 && g.length <= row.gap * 2.4).map(mean);
  }

  function mapNotes(image, layout, notes, clef = 'treble') {
    const positions = new Map(), labels = [...new Set(notes.map(n => Number(n.measure) || 1))].sort((a, b) => a - b);
    const maxMeasure = Math.max(0, ...labels), cells = [];
    layout.rows.forEach((row, rowIndex) => row.measures.forEach((box, column) => cells.push({ ...box, row, rowIndex, column })));
    const exact = cells.length === maxMeasure;
    notes.forEach(note => {
      const p = note.position;
      if (p && Number.isFinite(Number(p.xPct)) && Number.isFinite(Number(p.yPct)) && p.xPct >= 0 && p.xPct <= 100 && p.yPct >= 0 && p.yPct <= 100) {
        positions.set(note.id, { x: Number(p.xPct), y: Number(p.yPct), source: p.manual ? 'manual' : 'recognizer' });
      }
    });
    // ponytail: straight, single-staff printed scores only. Mismatched bar counts must be
    // manually located, not silently distributed across rows; neural boxes can supersede this.
    if (!exact) return { positions, exact, measureCount: cells.length, rowCounts: layout.rows.map(r => r.measures.length) };
    labels.forEach(measure => {
      const cell = cells[measure - 1], inMeasure = notes.filter(n => (Number(n.measure) || 1) === measure);
      const weights = inMeasure.map(n => Math.sqrt(beats(n))), total = weights.reduce((a, b) => a + b, 0);
      const inset = cell.row.gap * (cell.column === 0 ? 3.5 : 1.4);
      const start = cell.left + Math.min(inset, (cell.right - cell.left) * .22);
      const width = Math.max(1, cell.right - cell.row.gap - start);
      let elapsed = 0;
      const options = inMeasure.map((note, index) => {
        const expectedX = start + width * ((elapsed + weights[index] * .35) / total);
        elapsed += weights[index];
        const y = noteY(note, cell.row, clef), fixed = positions.get(note.id);
        if (fixed) return [{ x: fixed.x / 100 * layout.width, y: fixed.y / 100 * layout.height, cost: 0, fixed }];
        const candidates = note.rest ? [] : headCandidates(image, cell.row, cell, y);
        return [...candidates.map(x => ({ x, y, cost: Math.abs(x - expectedX) / width, source: 'notehead' })),
          { x: expectedX, y, cost: .7, source: 'measure-estimate' }];
      });
      // Ordered matching prevents the cursor from selecting the same notehead twice.
      const table = options.map(() => []);
      options.forEach((list, i) => list.forEach((candidate, j) => {
        let cost = i ? Infinity : candidate.cost, previous = -1;
        if (i) options[i - 1].forEach((p, k) => {
          if (candidate.x < p.x + cell.row.gap * .65) return;
          const next = table[i - 1][k].cost + candidate.cost;
          if (next < cost) { cost = next; previous = k; }
        });
        table[i][j] = { cost, previous };
      }));
      let selected = table.at(-1).reduce((best, value, j, values) => value.cost < values[best].cost ? j : best, 0);
      for (let i = inMeasure.length - 1; i >= 0; i--) {
        const option = options[i][selected], state = table[i][selected];
        if (Number.isFinite(state.cost) && !positions.has(inMeasure[i].id)) positions.set(inMeasure[i].id, {
          x: option.x / layout.width * 100, y: option.y / layout.height * 100,
          source: option.source, row: cell.rowIndex, measure
        });
        selected = state.previous;
        if (selected < 0) break;
      }
    });
    return { positions, exact, measureCount: cells.length, rowCounts: layout.rows.map(r => r.measures.length) };
  }

  function eventAtTime(events, time) {
    let low = 0, high = events.length - 1, index = -1;
    while (low <= high) { const middle = (low + high) >> 1; if (events[middle].start <= time) { index = middle; low = middle + 1; } else high = middle - 1; }
    return index >= 0 && time < events[index].end ? index : -1;
  }
  window.HetianScoreLayout = { detect, mapNotes, eventAtTime };
})();
