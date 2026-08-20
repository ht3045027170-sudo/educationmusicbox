/**
 * admin-music-editor.js
 * 教师端音乐编辑器 — 模拟键盘 + MIDI 键盘 + 五线谱实时渲染 + 钢琴采样播放
 * 依赖：teacher.html 已加载 sight-singing/piano-sampler.js (window.HetianPiano)
 * 导出：window.MusicEditor
 */
(() => {
  'use strict';

  /* ==================== 常量 ==================== */
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const DIATONIC_NAMES = ['C','D','E','F','G','A','B'];
  const SHARP_CLASSES = new Set([1, 3, 6, 8, 10]);
  const LETTERS = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const KEYS_START = 48;   // C3
  const KEYS_END = 84;    // C6 (exclusive)
  const MIN_MIDI = 48;
  const MAX_MIDI = 83;

  const DURATIONS = [
    { value: 4, label: '全音符' },
    { value: 2, label: '二分音符' },
    { value: 1, label: '四分音符' },
    { value: 0.5, label: '八分音符' },
    { value: 0.25, label: '十六分音符' },
    { value: 1/3, label: '三连音' },
  ];

  const DURATION_LABEL = {
    4: '𝅝', 2: '𝅗𝅥', 1: '♩', 0.5: '♪', 0.25: '♬', [1/3]: '♩₃'
  };
  // 附点等衍生时值显示
  const durationLabel = d => {
    if (DURATION_LABEL[d] !== undefined) return DURATION_LABEL[d];
    if (Math.abs(d - 1.5) < 0.001) return '♩·';
    if (Math.abs(d - 3) < 0.001) return '𝅗𝅥·';
    if (Math.abs(d - 0.75) < 0.001) return '♪·';
    return '时值' + Math.round(d * 100) / 100;
  };

  const METERS = ['4/4', '3/4', '2/4', '3/8', '6/8'];

  const KEY_SIGNATURES = {
    'C':  { label: 'C / a 小调', sharps: [], flats: [] },
    'G':  { label: 'G / e 小调', sharps: [6], flats: [] },
    'D':  { label: 'D / b 小调', sharps: [6, 1], flats: [] },
    'A':  { label: 'A / f♯ 小调', sharps: [6, 1, 8], flats: [] },
    'E':  { label: 'E / c♯ 小调', sharps: [6, 1, 8, 3], flats: [] },
    'F':  { label: 'F / d 小调', sharps: [], flats: [10] },
    'Bb': { label: 'B♭ / g 小调', sharps: [], flats: [10, 3] },
    'Eb': { label: 'E♭ / c 小调', sharps: [], flats: [10, 3, 8] },
  };

  // 电脑键盘映射 (QWERTY 行 → 白键/黑键)
  const KEYBOARD_MAP = {
    'KeyA': 60, 'KeyW': 61, 'KeyS': 62, 'KeyE': 63, 'KeyD': 64, 'KeyF': 65,
    'KeyT': 66, 'KeyG': 67, 'KeyY': 68, 'KeyH': 69, 'KeyU': 70, 'KeyJ': 71,
    'KeyK': 72, 'KeyO': 73, 'KeyL': 74, 'KeyP': 75, 'Semicolon': 76,
  };

  /* ==================== 状态 ==================== */
  let state = {
    notes: [],
    duration: 1,
    dotted: false,
    keySignature: 'C',
    meter: '4/4',
    bpm: 100,
    category: 'single',
    chordMode: false,
    chordBuffer: [],
  };
  let audioContext = null;
  let midiAccess = null;
  let activeKeys = new Set(); // 当前按下的键 (防止重复触发)
  let history = [];
  let historyIndex = -1;

  /* ==================== 工具函数 ==================== */
  const $ = sel => document.querySelector(sel);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const diatonicPos = midi => (Math.floor(midi / 12) - 1) * 7 + LETTERS[((midi % 12) + 12) % 12];
  const isSharp = midi => SHARP_CLASSES.has(((midi % 12) + 12) % 12);
  const midiName = midi => {
    const pc = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    return NOTE_NAMES[pc] + octave;
  };
  const diatonicName = midi => {
    const pc = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    const letter = DIATONIC_NAMES[LETTERS[pc]];
    const accidental = isSharp(midi) ? '♯' : '';
    return letter + accidental + octave;
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  function getAudio() {
    if (!audioContext) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('浏览器不支持 Web Audio API');
      audioContext = new AC();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function saveHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(JSON.parse(JSON.stringify(state.notes)));
    historyIndex = history.length - 1;
    if (history.length > 50) { history.shift(); historyIndex--; }
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    state.notes = JSON.parse(JSON.stringify(history[historyIndex]));
    render();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    state.notes = JSON.parse(JSON.stringify(history[historyIndex]));
    render();
  }

  /* ==================== 钢琴采样播放 ==================== */
  async function ensurePiano() {
    const piano = window.HetianPiano;
    if (!piano) throw new Error('钢琴采样未加载');
    await piano.prepare(getAudio());
    if (!piano.isReady?.()) throw new Error('钢琴采样尚未准备完成');
    return piano;
  }

  function playNote(midi, when = null, duration = 0.5, velocity = 0.7) {
    try {
      const ctx = getAudio();
      const t = when ?? ctx.currentTime;
      const piano = window.HetianPiano;
      if (!piano || !piano.isReady?.()) return;
      piano.play(ctx, midi, t, duration, velocity);
    } catch (e) { /* 静默 */ }
  }

  async function playSequence() {
    if (!state.notes.length) return;
    const playBtn = document.getElementById('mePlay');
    if (playBtn) { playBtn.disabled = true; playBtn.textContent = '播放中…'; }
    try {
      await ensurePiano();
    } catch (e) {
      if (playBtn) { playBtn.disabled = false; playBtn.textContent = '▶ 播放'; }
      alert('钢琴采样加载失败：' + e.message + '\n请确保 sight-singing/piano-samples 文件完整。');
      return;
    }
    const ctx = getAudio();
    const beat = 60 / state.bpm;
    let t = ctx.currentTime + 0.06;
    for (const n of state.notes) {
      const dur = n.dur * beat;
      if (!n.rest) {
        playNote(n.midi, t, Math.max(0.08, dur * 0.92), 0.72);
      }
      t += dur;
    }
    const totalMs = (t - ctx.currentTime) * 1000 + 200;
    setTimeout(() => {
      if (playBtn) { playBtn.disabled = false; playBtn.textContent = '▶ 播放'; }
    }, totalMs);
  }

  /* ==================== 五线谱渲染 ==================== */
  function renderStaff(notes, keySig, meter, category) {
    const seq = notes && notes.length ? notes : [{ midi: 60, dur: 1, rest: true }];
    const ink = '#263c48';
    const line = '#60727d';
    const md = String(meter || '4/4').split('/');
    const beatsPerBar = Math.max(1, (+md[0] || 4) * 4 / (+md[1] || 4));
    const keyData = KEY_SIGNATURES[keySig] || KEY_SIGNATURES['C'];

    // 初始化调号状态：调号内的升/降号默认生效
    const initState = new Map();
    keyData.sharps.forEach(pc => {
      for (let oct = 3; oct <= 6; oct++) {
        const letterIdx = LETTERS[pc];
        initState.set(`${oct}:${letterIdx}`, 'sharp');
      }
    });
    keyData.flats.forEach(pc => {
      for (let oct = 3; oct <= 6; oct++) {
        const letterIdx = LETTERS[pc];
        initState.set(`${oct}:${letterIdx}`, 'flat');
      }
    });

    function staffAccidental(n, accState) {
      if (n.rest) return '';
      const midi = Math.round(n.midi);
      const pc = ((midi % 12) + 12) % 12;
      const letterIdx = LETTERS[pc];
      const octave = Math.floor(midi / 12) - 1;
      const key = `${octave}:${letterIdx}`;
      const wanted = isSharp(midi) ? 'sharp' : 'natural';
      const previous = accState.get(key) || 'natural';
      accState.set(key, wanted);
      if (wanted === 'sharp' && previous !== 'sharp') return '♯';
      if (wanted === 'natural' && previous === 'sharp') return '♮';
      return '';
    }

    function drawNote(n, x, bottom, gap, accState, accShift = 0) {
      if (n.rest) return `<path d="M${x-5} ${bottom-gap*2.8}h10l-7 7 7 7-9 10" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linejoin="round"/>`;
      const y = bottom - (diatonicPos(n.midi) - 30) * (gap / 2);
      const accidental = staffAccidental(n, accState);
      let out = '';
      // 加线
      for (let ly = bottom + gap; ly <= y; ly += gap)
        out += `<line x1="${x-11}" y1="${ly}" x2="${x+11}" y2="${ly}" stroke="${line}" stroke-width="1.2"/>`;
      for (let ly = bottom - gap * 5; ly >= y; ly -= gap)
        out += `<line x1="${x-11}" y1="${ly}" x2="${x+11}" y2="${ly}" stroke="${line}" stroke-width="1.2"/>`;
      if (accidental)
        out += `<text x="${x-28-accShift}" y="${y+5}" font-size="18" font-weight="700" fill="${ink}">${accidental}</text>`;
      const whole = n.dur >= 4, hollow = whole || n.dur >= 2;
      out += `<ellipse cx="${x}" cy="${y}" rx="7.5" ry="5" transform="rotate(-18 ${x} ${y})" fill="${hollow ? '#fff' : ink}" stroke="${ink}" stroke-width="2"/>`;
      if (!whole)
        out += `<line x1="${x+6.5}" y1="${y}" x2="${x+6.5}" y2="${y-25}" stroke="${ink}" stroke-width="2"/>`;
      const flags = n.dur <= 0.25 ? 2 : n.dur <= 0.5 ? 1 : 0;
      for (let f = 0; f < flags; f++)
        out += `<path d="M${x+6.5} ${y-25+f*7}q14 7 4 17" fill="none" stroke="${ink}" stroke-width="2"/>`;
      if ([3, 1.5, 0.75, 0.375, 0.1875].includes(n.dur))
        out += `<circle cx="${x+14}" cy="${y}" r="2.1" fill="${ink}"/>`;
      return out;
    }

    function drawKeySignature(x, top, gap, ink) {
      let out = '';
      const positions = { 6: 0, 1: 1, 8: 2, 3: 3, 10: 4 }; // 升号顺序 F# C# G# D# A#
      const flatPositions = { 10: 0, 3: 1, 8: 2, 1: 3, 6: 4 }; // 降号顺序 Bb Eb Ab Db Gb
      const sharpY = [top - gap * 0.5, top + gap * 2.5, top - gap * 1.5, top + gap * 1.5, top + gap * 0.5];
      const flatY = [top + gap * 1.5, top - gap * 0.5, top + gap * 2.5, top + gap * 0.5, top - gap * 1.5];
      keyData.sharps.forEach((pc, i) => {
        out += `<text x="${x + i * 9}" y="${sharpY[positions[pc]] || top}" font-size="16" font-weight="700" fill="${ink}">♯</text>`;
      });
      keyData.flats.forEach((pc, i) => {
        out += `<text x="${x + i * 9}" y="${flatY[flatPositions[pc]] || top}" font-size="16" font-weight="700" fill="${ink}">♭</text>`;
      });
      return out;
    }

    function clefSVG(x, top, gap, ink) {
      const scale = gap / 10;
      return `<g class="staff-clef-vector" transform="translate(${x} ${top - 17}) scale(${scale})" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 1C9 15 10 28 22 35C36 43 34 58 23 62C13 66 5 59 6 50C7 42 14 37 22 38C29 39 31 45 29 50C27 55 22 56 18 53"/><path d="M20 1C25 14 17 27 16 39L20 70C21 80 17 87 11 85C7 84 5 80 7 77"/><circle cx="18" cy="49" r="2.2" fill="${ink}" stroke="none"/></g>`;
    }

    const barred = seq.some(n => Number.isInteger(n.bar));
    if (barred) {
      const w = 720, h = 174, gap = 7.5, systemGap = 82, barWidth = (w - 62) / 4;
      let svg = `<svg class="me-staff-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${meter}拍五线谱">`;
      for (let row = 0; row < 2; row++) {
        const top = 7 + row * systemGap, bottom = top + gap * 4;
        for (let l = 0; l < 5; l++)
          svg += `<line x1="4" y1="${top + l * gap}" x2="${w - 8}" y2="${top + l * gap}" stroke="${line}" stroke-width="1"/>`;
        svg += clefSVG(5, top, gap, ink);
        svg += drawKeySignature(46, top, gap, ink);
        if (row === 0)
          svg += `<text x="${46 + (keyData.sharps.length + keyData.flats.length) * 9 + 5}" y="${top + 13}" font-size="12" font-weight="800">${md[0]}</text><text x="${46 + (keyData.sharps.length + keyData.flats.length) * 9 + 5}" y="${top + 28}" font-size="12" font-weight="800">${md[1] || 4}</text>`;
        const barlineX = 54 + (keyData.sharps.length + keyData.flats.length) * 9;
        svg += `<line x1="${barlineX}" y1="${top}" x2="${barlineX}" y2="${bottom}" stroke="${ink}" stroke-width="1.2"/>`;
        for (let slot = 0; slot < 4; slot++) {
          const bar = row * 4 + slot;
          const x0 = barlineX + slot * ((w - barlineX - 8) / 4), x1 = barlineX + (slot + 1) * ((w - barlineX - 8) / 4);
          const barNotes = seq.filter(n => n.bar === bar);
          const accState = new Map(initState);
          svg += `<line x1="${x1}" y1="${top}" x2="${x1}" y2="${bottom}" stroke="${ink}" stroke-width="${bar === 7 ? 2.5 : 1.2}"/>`;
          barNotes.forEach((n, i) => {
            const x = x0 + 18 + (i + 0.5) * Math.max(16, (x1 - x0 - 25) / Math.max(1, barNotes.length));
            svg += drawNote(n, x, bottom, gap, accState);
          });
        }
      }
      return svg + '</svg>';
    }

    // 非小节模式 (单行五线谱)
    const simultaneous = category === 'interval' || category === 'chord';
    const w = simultaneous ? 290 : Math.max(360, 130 + seq.length * 66);
    const h = 118, gap = 10, top = 28, bottom = top + gap * 4;
    const start = 88, end = w - 13;
    let svg = `<svg class="me-staff-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="五线谱">`;
    for (let l = 0; l < 5; l++)
      svg += `<line x1="4" y1="${top + l * gap}" x2="${w - 10}" y2="${top + l * gap}" stroke="${line}" stroke-width="1"/>`;
    svg += clefSVG(5, top, gap, ink);
    svg += drawKeySignature(46, top, gap, ink);
    const tsX = 46 + (keyData.sharps.length + keyData.flats.length) * 9 + 5;
    svg += `<text x="${tsX}" y="${top + 17}" font-size="15" font-weight="800">${md[0]}</text><text x="${tsX}" y="${top + 36}" font-size="15" font-weight="800">${md[1] || 4}</text>`;
    const barlineX = tsX + 18;
    svg += `<line x1="${barlineX}" y1="${top}" x2="${barlineX}" y2="${bottom}" stroke="${ink}" stroke-width="1.2"/>`;

    const accState = new Map(initState);
    let accumulated = 0;
    seq.forEach((n, i) => {
      if (simultaneous) {
        const x = barlineX + 60 + (i - (seq.length - 1) / 2) * 16;
        svg += drawNote(n, x, bottom, gap, accState, Math.max(0, i) * 9);
      } else {
        const x = barlineX + 12 + i * Math.max(30, (end - barlineX - 12) / Math.max(1, seq.length - 1));
        svg += drawNote(n, x, bottom, gap, accState);
        accumulated += Math.abs(+n.dur || 1);
        if (i < seq.length - 1 && Math.abs(accumulated / beatsPerBar - Math.round(accumulated / beatsPerBar)) < 0.001) {
          const nextX = barlineX + 12 + (i + 1) * Math.max(30, (end - barlineX - 12) / Math.max(1, seq.length - 1));
          const barX = (x + nextX) / 2;
          svg += `<line x1="${barX}" y1="${top}" x2="${barX}" y2="${bottom}" stroke="${ink}" stroke-width="1.2"/>`;
          accState.clear();
          keyData.sharps.forEach(pc => {
            for (let oct = 3; oct <= 6; oct++) accState.set(`${oct}:${LETTERS[pc]}`, 'sharp');
          });
          keyData.flats.forEach(pc => {
            for (let oct = 3; oct <= 6; oct++) accState.set(`${oct}:${LETTERS[pc]}`, 'flat');
          });
        }
      }
    });
    svg += `<line x1="${end}" y1="${top}" x2="${end}" y2="${bottom}" stroke="${ink}" stroke-width="2.4"/>`;
    return svg + '</svg>';
  }

  /* ==================== 钢琴键盘 UI ==================== */
  function buildKeyboard(container) {
    const whiteKeys = [];
    for (let m = KEYS_START; m <= KEYS_END; m++) {
      if (!SHARP_CLASSES.has(m % 12)) whiteKeys.push(m);
    }
    const whiteCount = whiteKeys.length;
    let html = '<div class="me-piano"><div class="me-piano-white">';
    whiteKeys.forEach(m => {
      const label = m % 12 === 0 ? 'C' + (Math.floor(m / 12) - 1) : '';
      html += `<button class="me-key me-white" data-midi="${m}" type="button">${label}</button>`;
    });
    html += '</div><div class="me-piano-black">';
    for (let m = KEYS_START; m <= KEYS_END; m++) {
      if (!SHARP_CLASSES.has(m % 12)) continue;
      const precedingWhite = whiteKeys.filter(x => x < m).length;
      const leftPct = (precedingWhite / whiteCount * 100) - (100 / whiteCount * 0.5);
      html += `<button class="me-key me-black" data-midi="${m}" type="button" style="left:${leftPct}%"></button>`;
    }
    html += '</div></div>';
    container.innerHTML = html;

    // 绑定鼠标/触摸事件
    container.querySelectorAll('.me-key').forEach(key => {
      const midi = +key.dataset.midi;
      const press = (e) => {
        e.preventDefault();
        handleNoteOn(midi, 'mouse');
      };
      const release = (e) => {
        e.preventDefault();
        handleNoteOff(midi, 'mouse');
      };
      key.addEventListener('pointerdown', press);
      key.addEventListener('pointerup', release);
      key.addEventListener('pointerleave', release);
      key.addEventListener('pointercancel', release);
    });
  }

  /* ==================== 音符输入逻辑 ==================== */
  function handleNoteOn(midi, source = 'mouse') {
    if (activeKeys.has(midi)) return;
    activeKeys.add(midi);

    // 播放音符
    playNote(midi, null, 0.6, 0.8);

    // 视觉反馈
    const keyEl = document.querySelector(`.me-key[data-midi="${midi}"]`);
    if (keyEl) keyEl.classList.add('me-key-active');

    // 和弦模式：缓存音符，等所有键释放后一起加入
    if (state.chordMode && (state.category === 'chord' || state.category === 'interval')) {
      if (!state.chordBuffer.find(n => n.midi === midi)) {
        state.chordBuffer.push({ midi, dur: state.duration * (state.dotted ? 1.5 : 1), rest: false });
      }
      return;
    }

    // 非和弦模式：立即添加
    saveHistory();
    const dur = state.duration * (state.dotted ? 1.5 : 1);
    state.notes.push({ midi, dur, rest: false });
    render();
  }

  function handleNoteOff(midi, source = 'mouse') {
    if (!activeKeys.has(midi)) return;
    activeKeys.delete(midi);

    const keyEl = document.querySelector(`.me-key[data-midi="${midi}"]`);
    if (keyEl) keyEl.classList.remove('me-key-active');

    // 和弦模式：所有键释放后提交
    if (state.chordMode && (state.category === 'chord' || state.category === 'interval')) {
      if (activeKeys.size === 0 && state.chordBuffer.length > 0) {
        saveHistory();
        // 把缓存的音符作为同时发音的一组加入
        const dur = state.duration * (state.dotted ? 1.5 : 1);
        state.chordBuffer.forEach(n => { n.dur = dur; });
        // 对于和弦/音程，notes 数组就是同时发音的音符
        state.notes = [...state.chordBuffer];
        state.chordBuffer = [];
        render();
      }
    }
  }

  function addRest() {
    saveHistory();
    const dur = state.duration * (state.dotted ? 1.5 : 1);
    state.notes.push({ midi: 69, dur, rest: true });
    render();
  }

  function deleteNote(index) {
    saveHistory();
    state.notes.splice(index, 1);
    render();
  }

  function moveNote(index, dir) {
    const j = index + dir;
    if (j < 0 || j >= state.notes.length) return;
    saveHistory();
    [state.notes[index], state.notes[j]] = [state.notes[j], state.notes[index]];
    render();
  }

  function changeNotePitch(index, delta) {
    if (!state.notes[index] || state.notes[index].rest) return;
    saveHistory();
    state.notes[index].midi = clamp(state.notes[index].midi + delta, MIN_MIDI, MAX_MIDI);
    render();
  }

  function changeNoteDuration(index, dur) {
    if (!state.notes[index]) return;
    saveHistory();
    state.notes[index].dur = dur;
    render();
  }

  function clearAll() {
    if (!state.notes.length) return;
    if (!confirm('确定清空所有音符吗？')) return;
    saveHistory();
    state.notes = [];
    render();
  }

  /* ==================== Web MIDI API ==================== */
  async function connectMIDI() {
    const btn = document.getElementById('meMidiBtn');
    const status = document.getElementById('meMidiStatus');
    if (!navigator.requestMIDIAccess) {
      if (status) status.textContent = '当前浏览器不支持 Web MIDI';
      return;
    }
    try {
      midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      const bind = () => {
        midiAccess.inputs.forEach(input => {
          input.onmidimessage = handleMIDIMessage;
        });
      };
      bind();
      midiAccess.onstatechange = bind;
      const count = midiAccess.inputs.size;
      if (btn) btn.textContent = 'MIDI 已连接';
      if (status) status.textContent = count > 0 ? `MIDI 设备：${count} 个已连接` : 'MIDI 已就绪，未检测到设备';
    } catch (e) {
      if (btn) btn.textContent = 'MIDI 连接失败';
      if (status) status.textContent = '连接失败：' + e.message;
    }
  }

  function handleMIDIMessage(event) {
    const [data0, pitch, velocity] = event.data;
    const cmd = data0 & 0xf0;
    if (cmd === 0x90 && velocity > 0) {
      // Note On
      const midi = clamp(pitch, MIN_MIDI, MAX_MIDI);
      handleNoteOn(midi, 'midi');
    } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
      // Note Off
      const midi = clamp(pitch, MIN_MIDI, MAX_MIDI);
      handleNoteOff(midi, 'midi');
    }
  }

  /* ==================== 电脑键盘弹奏 ==================== */
  function isEditorActive() {
    const editor = document.getElementById('meKeyboard');
    if (!editor) return false;
    const container = document.getElementById('meContainer');
    if (container && container.style.display === 'none') return false;
    const dlg = editor.closest('dialog');
    if (dlg && !dlg.open) return false;
    return true;
  }

  function handleKeyboardDown(e) {
    if (e.repeat) return;
    if (!isEditorActive()) return;
    // 不拦截输入框内的按键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    const midi = KEYBOARD_MAP[e.code];
    if (midi !== undefined) {
      e.preventDefault();
      handleNoteOn(midi, 'keyboard');
    }
    // 快捷键
    if (e.code === 'Space') {
      e.preventDefault();
      playSequence();
    }
  }

  function handleKeyboardUp(e) {
    const midi = KEYBOARD_MAP[e.code];
    if (midi !== undefined) {
      e.preventDefault();
      handleNoteOff(midi, 'keyboard');
    }
  }

  /* ==================== 渲染 ==================== */
  function render() {
    // 五线谱
    const staff = document.getElementById('meStaff');
    if (staff) staff.innerHTML = renderStaff(state.notes, state.keySignature, state.meter, state.category);

    // 音符列表
    const list = document.getElementById('meNoteList');
    if (list) {
      if (!state.notes.length) {
        list.innerHTML = '<p class="me-empty">点击琴键或连接 MIDI 键盘开始录入音符</p>';
      } else {
        list.innerHTML = state.notes.map((n, i) => {
          const dur = n.dur;
          const durLabel = durationLabel(dur);
          if (n.rest) {
            return `<div class="me-note-chip me-rest">
              <span class="me-note-name">休止</span>
              <span class="me-note-dur">${esc(durLabel)}</span>
              <div class="me-note-actions">
                <button data-act="left" data-i="${i}" type="button">←</button>
                <button data-act="right" data-i="${i}" type="button">→</button>
                <button data-act="del" data-i="${i}" type="button" class="me-danger">删</button>
              </div>
            </div>`;
          }
          return `<div class="me-note-chip">
            <span class="me-note-name">${esc(diatonicName(n.midi))}</span>
            <span class="me-note-dur">${esc(durLabel)}</span>
            <div class="me-note-actions">
              <button data-act="down" data-i="${i}" type="button">−</button>
              <button data-act="up" data-i="${i}" type="button">+</button>
              <button data-act="left" data-i="${i}" type="button">←</button>
              <button data-act="right" data-i="${i}" type="button">→</button>
              <button data-act="del" data-i="${i}" type="button" class="me-danger">删</button>
            </div>
          </div>`;
        }).join('');
        // 绑定按钮
        list.querySelectorAll('button[data-act]').forEach(btn => {
          btn.onclick = () => {
            const act = btn.dataset.act;
            const i = +btn.dataset.i;
            if (act === 'del') deleteNote(i);
            else if (act === 'left') moveNote(i, -1);
            else if (act === 'right') moveNote(i, 1);
            else if (act === 'up') changeNotePitch(i, 1);
            else if (act === 'down') changeNotePitch(i, -1);
          };
        });
      }
    }

    // 更新时值选择器
    const durSelect = document.getElementById('meDuration');
    if (durSelect) durSelect.value = String(state.duration);

    // 附点按钮
    const dotBtn = document.getElementById('meDotted');
    if (dotBtn) {
      dotBtn.classList.toggle('me-active', state.dotted);
      dotBtn.textContent = '附点 ' + (state.dotted ? '开' : '关');
    }

    // 调号
    const ksSelect = document.getElementById('meKeySig');
    if (ksSelect) ksSelect.value = state.keySignature;

    // 节拍
    const meterSelect = document.getElementById('meMeter');
    if (meterSelect) meterSelect.value = state.meter;

    // BPM
    const bpmInput = document.getElementById('meBpm');
    const bpmText = document.getElementById('meBpmText');
    if (bpmInput) bpmInput.value = state.bpm;
    if (bpmText) bpmText.textContent = String(state.bpm);

    // 和弦模式
    const chordBtn = document.getElementById('meChord');
    if (chordBtn) {
      chordBtn.classList.toggle('me-active', state.chordMode);
      const isChordType = state.category === 'chord' || state.category === 'interval';
      chordBtn.style.display = isChordType ? '' : 'none';
    }

    // 分类
    const catSelect = document.getElementById('meCategory');
    if (catSelect) catSelect.value = state.category;
  }

  /* ==================== 主渲染（构建完整 UI） ==================== */
  function mount(container, options = {}) {
    // 注入样式（只注入一次）
    if (!document.getElementById('me-styles')) {
      const style = document.createElement('style');
      style.id = 'me-styles';
      style.textContent = ME_STYLES;
      document.head.appendChild(style);
    }

    // 从 options 恢复状态
    if (options.notes) state.notes = JSON.parse(JSON.stringify(options.notes));
    if (options.keySignature) state.keySignature = options.keySignature;
    if (options.meter) state.meter = options.meter;
    if (options.bpm) state.bpm = options.bpm;
    if (options.category) state.category = options.category;

    // 初始化历史
    history = [JSON.parse(JSON.stringify(state.notes))];
    historyIndex = 0;

    container.innerHTML = `
      <div class="me-editor">
        <!-- 控制栏 -->
        <div class="me-controls">
          <div class="me-control-group">
            <label>题型
              <select id="meCategory">
                <option value="single">单音</option>
                <option value="interval">音程</option>
                <option value="chord">和弦</option>
                <option value="melody">旋律</option>
                <option value="rhythm">节奏</option>
              </select>
            </label>
            <label>调号
              <select id="meKeySig">
                ${Object.entries(KEY_SIGNATURES).map(([k, v]) =>
                  `<option value="${k}">${esc(v.label)}</option>`).join('')}
              </select>
            </label>
            <label>节拍
              <select id="meMeter">
                ${METERS.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </label>
            <label>速度 <span id="meBpmText">${state.bpm}</span> BPM
              <input id="meBpm" type="range" min="40" max="200" value="${state.bpm}">
            </label>
          </div>
          <div class="me-control-group">
            <label>时值
              <select id="meDuration">
                ${DURATIONS.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
              </select>
            </label>
            <button id="meDotted" class="me-toggle" type="button">附点 关</button>
            <button id="meChord" class="me-toggle" type="button" style="display:none">和弦模式</button>
            <button id="meRest" type="button" class="me-secondary">休止符</button>
            <button id="meUndo" type="button" class="me-secondary">↶ 撤销</button>
            <button id="meRedo" type="button" class="me-secondary">↷ 重做</button>
            <button id="meClear" type="button" class="me-danger">清空</button>
          </div>
        </div>

        <!-- 五线谱预览 -->
        <div class="me-staff-container" id="meStaff"></div>

        <!-- 音符列表 -->
        <div class="me-note-list" id="meNoteList"></div>

        <!-- 钢琴键盘 -->
        <div class="me-keyboard-section">
          <div class="me-keyboard-header">
            <button id="mePlay" type="button" class="me-primary">▶ 播放</button>
            <button id="meMidiBtn" type="button" class="me-secondary">连接 MIDI</button>
            <span id="meMidiStatus" class="me-midi-status"></span>
          </div>
          <div id="meKeyboard" class="me-keyboard-wrap"></div>
          <p class="me-hint">电脑键盘弹奏：A S D F G H J K L（白键）· W E T Y U O P（黑键）· 空格播放</p>
        </div>
      </div>
    `;

    // 构建钢琴键盘
    buildKeyboard(document.getElementById('meKeyboard'));

    // 绑定事件
    document.getElementById('meDuration').onchange = e => { state.duration = +e.target.value; };
    document.getElementById('meDotted').onclick = () => { state.dotted = !state.dotted; render(); };
    document.getElementById('meChord').onclick = () => { state.chordMode = !state.chordMode; render(); };
    document.getElementById('meRest').onclick = addRest;
    document.getElementById('meUndo').onclick = undo;
    document.getElementById('meRedo').onclick = redo;
    document.getElementById('meClear').onclick = clearAll;
    document.getElementById('mePlay').onclick = playSequence;
    document.getElementById('meMidiBtn').onclick = connectMIDI;
    document.getElementById('meKeySig').onchange = e => { state.keySignature = e.target.value; render(); };
    document.getElementById('meMeter').onchange = e => { state.meter = e.target.value; render(); };
    document.getElementById('meBpm').oninput = e => { state.bpm = +e.target.value; document.getElementById('meBpmText').textContent = e.target.value; };
    document.getElementById('meCategory').onchange = e => {
      state.category = e.target.value;
      // 切换题型时清空音符（不同题型数据结构不同）
      if (state.notes.length && !confirm('切换题型会清空当前音符，确定吗？')) {
        e.target.value = state.category;
        return;
      }
      state.notes = [];
      saveHistory();
      render();
    };

    // 电脑键盘事件
    document.addEventListener('keydown', handleKeyboardDown);
    document.addEventListener('keyup', handleKeyboardUp);

    // 首次渲染
    render();
  }

  function destroy() {
    document.removeEventListener('keydown', handleKeyboardDown);
    document.removeEventListener('keyup', handleKeyboardUp);
    activeKeys.clear();
  }

  function getNotes() {
    return JSON.parse(JSON.stringify(state.notes));
  }

  function setNotes(notes) {
    state.notes = JSON.parse(JSON.stringify(notes || []));
    history = [JSON.parse(JSON.stringify(state.notes))];
    historyIndex = 0;
    render();
  }

  function getState() {
    return {
      notes: JSON.parse(JSON.stringify(state.notes)),
      keySignature: state.keySignature,
      meter: state.meter,
      bpm: state.bpm,
      category: state.category,
    };
  }

  function setState(s) {
    if (s.notes) state.notes = JSON.parse(JSON.stringify(s.notes));
    if (s.keySignature) state.keySignature = s.keySignature;
    if (s.meter) state.meter = s.meter;
    if (s.bpm) state.bpm = s.bpm;
    if (s.category) state.category = s.category;
    render();
  }

  /* ==================== 样式 ==================== */
  const ME_STYLES = `
.me-editor{border:1px solid #dce5df;border-radius:14px;padding:18px;background:#f8faf8;margin:14px 0}
.me-controls{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px}
.me-control-group{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}
.me-control-group label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#3a5346}
.me-control-group select,.me-control-group input[type=range]{padding:7px 10px;border:1px solid #cad8d0;border-radius:8px;font-size:13px;background:#fff}
.me-control-group input[type=range]{width:120px}
.me-toggle{padding:7px 12px;border:1px solid #cad8d0;border-radius:8px;background:#fff;color:#40534a;cursor:pointer;font-size:13px}
.me-toggle.me-active{background:#4d9b73;color:#fff;border-color:#4d9b73}
.me-secondary{padding:7px 12px;border:1px solid #cad8d0;border-radius:8px;background:#eef2ef;color:#40534a;cursor:pointer;font-size:13px}
.me-primary{padding:9px 18px;border:0;border-radius:9px;background:#4d9b73;color:#fff;cursor:pointer;font-size:14px;font-weight:650}
.me-danger{padding:7px 12px;border:1px solid #e8c5c5;border-radius:8px;background:#f8e8e8;color:#a23d3d;cursor:pointer;font-size:13px}
.me-staff-container{background:#fff;border:1px solid #dce5df;border-radius:10px;padding:12px;overflow:auto;margin-bottom:12px;min-height:130px}
.me-staff-container svg{display:block;width:100%;max-width:720px;height:auto}
.me-note-list{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;max-height:180px;overflow-y:auto}
.me-empty{color:#9bacA3;font-size:13px;padding:14px;text-align:center;width:100%}
.me-note-chip{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #dce5df;border-radius:8px;background:#fff;font-size:12px}
.me-note-chip.me-rest{background:#f0f4f1;border-style:dashed}
.me-note-name{font-weight:650;color:#263c48;min-width:36px}
.me-note-dur{color:#687970;font-size:11px}
.me-note-actions{display:flex;gap:3px}
.me-note-actions button{padding:3px 6px;border:1px solid #dce5df;border-radius:5px;background:#fff;cursor:pointer;font-size:11px;color:#51665b}
.me-note-actions .me-danger{padding:3px 6px;font-size:11px}
.me-keyboard-section{margin-top:10px}
.me-keyboard-header{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.me-midi-status{font-size:12px;color:#687970}
.me-keyboard-wrap{position:relative;user-select:none}
.me-piano{position:relative;height:140px;display:flex}
.me-piano-white{display:flex;flex:1;position:relative;z-index:1}
.me-piano-black{position:absolute;top:0;left:0;right:0;height:85px;z-index:2;pointer-events:none}
.me-key{border:1px solid #8a9b94;cursor:pointer;font-size:10px;font-weight:600;transition:background .08s}
.me-key.me-white{flex:1;height:100%;background:#fff;color:#9bacA3;border-radius:0 0 5px 5px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px}
.me-key.me-black{position:absolute;width:24px;height:100%;background:#263c48;color:#c8d8d0;border:1px solid #1a2a24;border-radius:0 0 4px 4px;pointer-events:auto}
.me-key.me-key-active.me-white{background:#4d9b73;color:#fff;transform:translateY(1px)}
.me-key.me-key-active.me-black{background:#3a8560;transform:translateY(1px)}
.me-hint{font-size:11px;color:#9bacA3;margin-top:8px;line-height:1.6}
@media(max-width:600px){
  .me-controls{flex-direction:column}
  .me-piano{height:100px}
  .me-piano-black{height:62px}
  .me-key.me-black{width:18px}
}
  `;

  async function playNotes(notes, opts = {}) {
    if (!notes || !notes.length) return;
    await ensurePiano();
    const ctx = getAudio();
    const bpm = opts.bpm || state.bpm || 100;
    const beat = 60 / bpm;
    let t = ctx.currentTime + 0.06;
    for (const n of notes) {
      const dur = n.dur * beat;
      if (!n.rest) playNote(n.midi, t, Math.max(0.08, dur * 0.92), 0.72);
      t += dur;
    }
    return (t - ctx.currentTime) * 1000 + 200;
  }

  /* ==================== 导出 ==================== */
  window.MusicEditor = { mount, destroy, getNotes, setNotes, getState, setState, playSequence, renderStaffPreview: renderStaff, playNotes };
})();
