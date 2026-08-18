(() => {
  'use strict';
  const NS = window.MusicScore = window.MusicScore || {};
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const INSTRUMENTS = {
    piano: { name: '钢琴', shortName: 'Pno.', family: '键盘', clef: 'grand', tone: 'piano', range: [21, 108] },
    voice: { name: '独唱', shortName: 'V.', family: '声乐', clef: 'treble', tone: 'choir', range: [48, 84] },
    guitar: { name: '民谣吉他', shortName: 'Gtr.', family: '弦乐', clef: 'treble', tone: 'guitar', range: [40, 88], tablature: true },
    violin: { name: '小提琴', shortName: 'Vln.', family: '弦乐', clef: 'treble', tone: 'violin', range: [55, 103] },
    cello: { name: '大提琴', shortName: 'Vc.', family: '弦乐', clef: 'bass', tone: 'cello', range: [36, 76] },
    bass: { name: '贝斯', shortName: 'Bass', family: '弦乐', clef: 'bass', tone: 'bass', range: [28, 67], tablature: true },
    flute: { name: '长笛', shortName: 'Fl.', family: '管乐', clef: 'treble', tone: 'flute', range: [60, 96] },
    clarinet: { name: '单簧管', shortName: 'Cl.', family: '管乐', clef: 'treble', tone: 'clarinet', range: [50, 94], transpose: 2 },
    trumpet: { name: '小号', shortName: 'Tpt.', family: '管乐', clef: 'treble', tone: 'trumpet', range: [54, 82], transpose: 2 },
    drums: { name: '架子鼓', shortName: 'Dr.', family: '打击乐', clef: 'percussion', tone: 'drums', range: [35, 81] }
  };

  function midiName(midi) {
    const value = Math.max(0, Math.min(127, Math.round(+midi || 60)));
    return NOTE_NAMES[value % 12] + (Math.floor(value / 12) - 1);
  }
  function makeMeasure(index, meter = '4/4') {
    const [beats, unit] = meter.split('/').map(Number);
    return {
      id: uid('measure'), index, timeSignature: { numerator: beats || 4, denominator: unit || 4 },
      keySignature: index === 0 ? 'C' : null, voices: [[], [], [], []],
      chordSymbols: [], harmonyFunctions: [], layoutBreak: false
    };
  }
  function makePart(type = 'piano', notation = 'staff') {
    const preset = INSTRUMENTS[type] || INSTRUMENTS.piano;
    return {
      id: uid('part'), instrumentId: type, name: preset.name, shortName: preset.shortName,
      family: preset.family, clef: preset.clef, tone: preset.tone, range: preset.range,
      transpose: preset.transpose || 0, midiChannel: 1, volume: .82, pan: 0,
      mute: false, solo: false, notation, showStaff: true,
      showNumbered: notation === 'numbered' || notation === 'staff-numbered',
      showTab: notation === 'tab' || notation === 'staff-tab' || !!preset.tablature,
      tuning: type === 'bass' ? [28, 33, 38, 43] : [40, 45, 50, 55, 59, 64]
    };
  }
  function createScore(options = {}) {
    const meter = options.meter || '4/4';
    const measureCount = Math.max(1, Math.min(128, +options.measures || 8));
    const notation = options.notation || 'staff';
    const instrumentIds = options.instruments?.length ? options.instruments : ['piano'];
    return {
      schemaVersion: 1, id: uid('score'),
      metadata: {
        title: options.title || '未命名乐谱', subtitle: options.subtitle || '',
        composer: options.composer || '', lyricist: options.lyricist || '',
        arranger: options.arranger || '', singer: options.singer || '',
        copyright: options.copyright || '', notes: options.notes || '',
        createdAt: Date.now(), updatedAt: Date.now()
      },
      settings: {
        tempo: Math.max(30, Math.min(260, +options.tempo || 120)), meter,
        key: options.key || 'C', pageSize: options.pageSize || 'A4',
        orientation: options.orientation || 'portrait', measuresPerSystem: +options.measuresPerSystem || 4,
        masterVolume: .82, zoom: 100, viewMode: 'page', metronome: false, countIn: false
      },
      parts: instrumentIds.map((id, index) => ({ ...makePart(id, notation), midiChannel: index + 1 })),
      measures: Array.from({ length: measureCount }, (_, index) => makeMeasure(index, meter)),
      partLayouts: {}, selectedPartId: null, createdFrom: 'music-toolbox-score'
    };
  }
  function makeEvent(data = {}) {
    const midi = Math.max(0, Math.min(127, Math.round(+data.midi || 60)));
    const duration = Math.max(.0625, +data.duration || 1);
    return {
      id: uid(data.rest ? 'rest' : 'note'), type: data.rest ? 'rest' : 'note',
      partId: data.partId || '',
      midi, noteName: midiName(midi), accidental: data.accidental || '',
      start: Math.max(0, +data.start || 0), duration, dots: Math.max(0, Math.min(2, +data.dots || 0)),
      voice: Math.max(0, Math.min(3, +data.voice || 0)), velocity: Math.max(1, Math.min(127, +data.velocity || 88)),
      lyric: data.lyric || '', lyricVerse: +data.lyricVerse || 1,
      tieStart: !!data.tieStart, tieStop: !!data.tieStop,
      articulation: data.articulation || '', dynamic: data.dynamic || '',
      tab: data.tab || null, hidden: false, play: data.play !== false
    };
  }
  function migrateScore(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('无效的乐谱文件');
    if (!raw.schemaVersion) raw.schemaVersion = 1;
    if (raw.schemaVersion > 1) throw new Error('此乐谱来自更高版本，当前版本无法打开');
    raw.parts = Array.isArray(raw.parts) && raw.parts.length ? raw.parts : [makePart()];
    raw.measures = Array.isArray(raw.measures) && raw.measures.length ? raw.measures : [makeMeasure(0)];
    raw.measures.forEach((measure, index) => {
      measure.id ||= uid('measure'); measure.index = index;
      measure.voices ||= [[], [], [], []];
      while (measure.voices.length < 4) measure.voices.push([]);
      measure.chordSymbols ||= []; measure.harmonyFunctions ||= [];
      measure.voices.forEach(voice => voice.forEach(event => {
        event.id ||= uid(event.type === 'rest' ? 'rest' : 'note');
        event.noteName = midiName(event.midi);
      }));
    });
    const defaults = createScore();
    raw.settings = { ...defaults.settings, ...(raw.settings || {}) };
    raw.metadata = { ...defaults.metadata, ...(raw.metadata || {}) };
    return raw;
  }
  function findEvent(score, eventId) {
    for (const measure of score.measures) {
      for (let voiceIndex = 0; voiceIndex < measure.voices.length; voiceIndex++) {
        const eventIndex = measure.voices[voiceIndex].findIndex(event => event.id === eventId);
        if (eventIndex >= 0) return { measure, voiceIndex, eventIndex, event: measure.voices[voiceIndex][eventIndex] };
      }
    }
    return null;
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  NS.model = { uid, NOTE_NAMES, INSTRUMENTS, midiName, makeMeasure, makePart, createScore, makeEvent, migrateScore, findEvent, clone };
})();
