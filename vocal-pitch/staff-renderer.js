(() => {
  'use strict';
  const root = window.MusicVocal = window.MusicVocal || {};
  const letters = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const sharps = new Set([1, 3, 6, 8, 10]);
  const diatonic = midi => (Math.floor(midi / 12) - 1) * 7 + letters[((midi % 12) + 12) % 12];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  class StaffRenderer {
    constructor(container) {
      this.container = container;
      this.notes = [];
      this.notesPerLine = 12;
    }
    setNotes(notes) { this.notes = notes.slice(); this.render(); }
    clear() { this.notes = []; this.render(); }
    noteGlyph(note, x, y, top, bottom, gap, ink, staff) {
      let out = '';
      for (let ly = bottom + gap; ly <= y + 1; ly += gap) {
        out += `<line x1="${x - 13}" y1="${ly}" x2="${x + 13}" y2="${ly}" stroke="${staff}" stroke-width="1.3"/>`;
      }
      for (let ly = top - gap; ly >= y - 1; ly -= gap) {
        out += `<line x1="${x - 13}" y1="${ly}" x2="${x + 13}" y2="${ly}" stroke="${staff}" stroke-width="1.3"/>`;
      }
      if (sharps.has(((note.midi % 12) + 12) % 12)) {
        out += `<text x="${x - 25}" y="${y + 6}" fill="${ink}" font-size="20" font-family="Georgia,serif">♯</text>`;
      }
      const beats = Number(note.durationBeats) || 1;
      const open = beats >= 2;
      out += `<ellipse cx="${x}" cy="${y}" rx="8.4" ry="5.7" transform="rotate(-18 ${x} ${y})" fill="${open ? 'none' : ink}" stroke="${ink}" stroke-width="${open ? 2.2 : 1.2}"/>`;
      if (beats < 4) {
        const up = y > top + gap * 2;
        const sx = up ? x + 7 : x - 7;
        const sy = up ? y - 35 : y + 35;
        out += `<line x1="${sx}" y1="${y}" x2="${sx}" y2="${sy}" stroke="${ink}" stroke-width="2"/>`;
        if (beats < .75) {
          out += up
            ? `<path d="M${sx} ${sy}q15 6 7 19" fill="none" stroke="${ink}" stroke-width="2.2"/>`
            : `<path d="M${sx} ${sy}q-15 -6 -7 -19" fill="none" stroke="${ink}" stroke-width="2.2"/>`;
        }
      }
      if ([1.5, 3].includes(beats)) out += `<circle cx="${x + 15}" cy="${y}" r="2.1" fill="${ink}"/>`;
      return out;
    }
    render() {
      const width = 884, gap = 12, lineHeight = 250;
      const rows = Math.max(1, Math.ceil(this.notes.length / this.notesPerLine));
      const height = rows * lineHeight + 18;
      const ink = '#e9f0ec', staff = '#708078';
      let svg = `<svg class="vocal-score-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="实时人声五线谱">`;
      for (let row = 0; row < rows; row++) {
        // Extra top/bottom room keeps C3-C7 ledger lines inside the SVG after
        // the requested one-octave display transposition.
        const top = 120 + row * lineHeight, bottom = top + gap * 4;
        for (let line = 0; line < 5; line++) {
          const y = top + line * gap;
          svg += `<line x1="22" y1="${y}" x2="${width - 18}" y2="${y}" stroke="${staff}" stroke-width="1.35"/>`;
        }
        svg += `<line x1="22" y1="${top}" x2="22" y2="${bottom}" stroke="${staff}" stroke-width="2"/>`;
        /* Public-domain glyph: Wikimedia Commons File:Treble clef.svg. */
        svg += `<image href="vocal-pitch/treble-clef.svg" x="31" y="${top - 28}" width="52" height="102" preserveAspectRatio="xMidYMid meet"/>`;
        const items = this.notes.slice(row * this.notesPerLine, (row + 1) * this.notesPerLine);
        items.forEach((note, index) => {
          const x = 112 + index * 62;
          const y = bottom - (diatonic(note.midi) - 30) * (gap / 2);
          svg += this.noteGlyph(note, x, y, top, bottom, gap, ink, staff);
          svg += `<text x="${x}" y="${bottom + 31}" text-anchor="middle" fill="#9bacA3" font-size="10">${esc(note.label)} · ${esc(note.rhythmLabel || '♩')}</text>`;
        });
        if (items.length) {
          const barX = Math.min(width - 20, 112 + items.length * 62 - 30);
          svg += `<line x1="${barX}" y1="${top}" x2="${barX}" y2="${bottom}" stroke="${staff}" stroke-width="1.8"/>`;
        }
      }
      this.container.innerHTML = svg + '</svg>';
      this.container.scrollLeft = this.container.scrollWidth;
    }
  }
  root.StaffRenderer = StaffRenderer;
})();
