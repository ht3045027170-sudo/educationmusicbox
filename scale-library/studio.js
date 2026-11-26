(() => {
  'use strict';
  const shell = document.getElementById('scaleStudio');
  const H = window.HetianChordLibrary, S = window.HetianScales, I = window.HetianScaleInstrument;
  const app = window.HetianApp;
  if (!shell || !I || !app?.chordAudio) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[char]);
  const option = (value, label, selected) =>
    `<option value="${escape(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escape(label)}</option>`;
  const action = (name, label, value = '') =>
    `<button type="button" data-ss-action="${name}" data-value="${escape(value)}">${escape(label)}</button>`;
  const select = (name, label, options) => `<label>${label}<select data-ss="${name}">${options}</select></label>`;
  const scaleOptions = value => Object.entries(S.groups).map(([group, [label]]) => `<optgroup label="${label}">${S.collection
    .filter(scale => scale.group === group).map(scale => option(scale.id, `${scale.zh} · ${scale.en}`, value)).join('')}</optgroup>`).join('');
  const rootOptions = value => H.keys.map(key => option(key, key, value)).join('');
  const chordOptions = value => [...H.types.keys()].map(id => option(id, id ? H.suffixLabel(id) : '大三', value)).join('');
  const pages = [['atlas','音阶图鉴'],['compare','音阶对比'],['arp','琶音'],['memory','记忆训练'],
    ['licks','个人乐句'],['improv','即兴伴奏'],['progress','学习记录']];
  const shapes = [
    ['full','全指板 0–24 品'], ['caged','CAGED 五区域'], ['three','每弦三音'], ['two','每弦两音'],
    ['single','单弦横向'], ['custom','自定义把位'], ['cross','跨把位连接'], ['start','由指定弦主音起步'],
  ];
  const labels = [['name','实际音名'],['sol','首调 Do Re Mi'],['degree','数字简谱唱名'],['interval','主音相对音程'],
    ['finger','推荐左手指法'],['dot','纯圆点'],['root','仅主音'],['target','仅和弦目标音'],['hide','隐藏答案']];
  const colors = {root:'#b74c13',third:'#237654',fifth:'#5d6965',seventh:'#8154a3',feature:'#bb353c',other:'#2e68a2'};
  const steps = ['未学习','学习中','能够演奏','能够移调','能够自由应用'];
  const blank = () => ({ version:1, licks:[], history:[], queue:{}, progress:{}, plan:'', palette:{...colors} });
  const recordKey = 'haitang-scale-studio-v1';
  function read() {
    try { return normalize(JSON.parse(window.localStorage.getItem(recordKey))); }
    catch (_) { return blank(); }
  }
  function normalize(raw) {
    if (!raw || raw.version !== 1) return blank();
    const dictionary = object => Object.fromEntries(Object.entries(object || {}).filter(([key]) =>
      key.length <= 120 && !['__proto__','constructor','prototype'].includes(key)));
    const validLicks = Array.isArray(raw.licks) ? raw.licks.filter(lick => {
      if (!lick || typeof lick.id !== 'string' || typeof lick.name !== 'string' || typeof lick.tab !== 'string' ||
          !H.keys.includes(lick.key) || !Number.isFinite(Number(lick.bpm))) return false;
      try { return I.parseTab(lick.tab).length > 0; } catch (_) { return false; }
    }).slice(0,1000) : [];
    const palette = Object.fromEntries(Object.entries(colors).map(([key, value]) =>
      [key, /^#[a-f0-9]{6}$/i.test(raw.palette?.[key]) ? raw.palette[key] : value]));
    const history = Array.isArray(raw.history) ? raw.history.filter(item => item &&
      Number.isFinite(item.at) && Number.isFinite(item.ms) && item.ms >= 0 &&
      typeof item.mode === 'string' && typeof item.ok === 'boolean').slice(-5000) : [];
    const queue = Object.fromEntries(Object.entries(dictionary(raw.queue)).filter(([,item]) =>
      item && Number.isFinite(item.last) && Number.isFinite(item.due) && Number.isFinite(item.streak) &&
      Number.isFinite(item.attempts) && Number.isFinite(item.correct)));
    const progress = Object.fromEntries(Object.entries(dictionary(raw.progress)).filter(([,step]) =>
      Number.isInteger(step) && step >= 0 && step < steps.length));
    return { version:1, licks:validLicks, history, queue, progress, plan:typeof raw.plan === 'string' ? raw.plan.slice(0,5000) : '', palette };
  }
  let store = read();
  const getStore = () => store;
  const persist = () => {
    try { localStorage.setItem(recordKey, JSON.stringify(store)); }
    catch (_) { status('设备存储空间已满或不可用，请在学习记录导出备份。'); }
  };
  const saveRecord = (index, ok, ms, details) => {
    const at = Date.now();
    store.history.push({ ...details, index, ok, ms, at });
    store.history = store.history.slice(-5000);
    store.queue[index] = { ...I.review(store.queue[index], ok, at), ...details };
    persist();
  };
  const replaceStore = raw => {
    if (raw?.version !== 1 || !Array.isArray(raw.licks) || !Array.isArray(raw.history)) throw Error('文件不是版本 1 的海棠训练备份。');
    const result = normalize(raw);
    store = result;
    updatePalette();
    persist();
  };
  function updatePalette() {
    Object.entries(store.palette).forEach(([name, color]) => shell.style.setProperty('--ss-' + name,color));
  }
  const state = { page:'atlas', key:'A', scale:'minor-pent', labels:'interval', sol:'relative', layout:'caged',
    direction:'up', from:5, to:9, string:6, orientation:'vertical', single:false, color:true, chord:'m7' };
  const get = name => shell.querySelector(`[data-ss="${name}"]`);
  const status = message => { get('status').textContent = message; };
  const modules = new Map();
  const controller = {};
  const AppAudio = app.chordAudio;
  const scope = 'scale-studio';
  let token = 0, samples = null, timer = 0, transportStarted = 0;
  function stop() {
    token++;
    clearTimeout(timer);
    AppAudio.stopAudioScope(scope);
    window.HetianGuitar?.stopAll();
    if (transportStarted) {
      const ms = Date.now() - transportStarted;
      if (ms >= 1000) saveRecord('session:' + state.page, true, ms,
        {mode:'session', key:state.key, scale:state.scale, pattern:state.layout, interval:'', errors:[]});
      transportStarted = 0;
    }
  }
  async function prepare() {
    stop();
    const generation = token;
    try {
      const context = app.getAudio();
      if (context.state !== 'running') await context.resume();
      if (generation !== token) return null;
      if (samples !== context) window.HetianGuitar?.prepareSamples(context).then(() => {samples = context;}).catch(() => {});
      return {context, generation};
    } catch (_) { status('浏览器暂停了网页音频，点播放可重试。'); return null; }
  }
  function voice(audio, note, when, duration, guitar = true, volume = .17) {
    const midi = typeof note === 'number' ? note : note.midi;
    if (guitar && samples === audio) window.HetianGuitar.playSample(audio, midi, when, duration, volume * 1.9, note.stringMidi);
    else AppAudio.voice(midi,when,duration,guitar ? 'guitar' : 'piano',volume,scope);
  }
  async function play(notes, {bpm=110, loop=false, metro=false, guitar=true, chord=[]} = {}) {
    if (!notes.length) return;
    const sound = await prepare();
    if (!sound) return;
    if (loop) transportStarted = Date.now();
    const audio = sound.context, beat = 60 / bpm;
    const length = notes.reduce((sum,n) => sum + (n.beats || .5), 0) * beat;
    const cycle = () => {
      if (sound.generation !== token) return;
      let at = audio.currentTime + .035;
      chord.forEach(midi => voice(audio,midi,at,Math.max(.2,length),false,.055));
      if (metro) for (let i = 0; i < length / beat - .01; i++) AppAudio.clickSound(i % 4 === 0,at + i*beat,scope);
      notes.forEach(note => {
        const duration = (note.beats || .5) * beat;
        if (!note.rest) {
          voice(audio,note,at,duration*.93,guitar);
          if (note.targetFret !== undefined && note.targetFret !== null) {
            voice(audio,{...note,midi:note.stringMidi + note.targetFret},at+duration*.42,duration*.55,guitar,.105);
          } else if (note.technique === '~') {
            voice(audio,note,at+duration*.45,duration*.48,guitar,.075);
          }
        }
        at += duration;
      });
      if (loop) timer = setTimeout(cycle,length*1000);
    };
    cycle();
  }

  async function backing(settings, bars, onBar) {
    const sound = await prepare();
    if (!sound) return;
    const {bpm, beats, unit, swing, loop, metro, bass, chords, style} = settings;
    const audio = sound.context, beat = 60 / bpm * 4 / unit, duration = beats * beat;
    let index = 0, next = audio.currentTime + .045;
    transportStarted = Date.now();
    const bar = () => {
      if (sound.generation !== token) return;
      const item = bars[index], when = Math.max(next,audio.currentTime+.018);
      onBar(index,item);
      const swingDelay = beat * (.5 + swing * .17);
      const bassSeq = style === 'Bossa Nova' ? [0,Math.min(2,beats-1)] : Array.from({length:beats},(_,i)=>i);
      if (bass) bassSeq.forEach((i,j) => voice(audio,j % 2 ? item.bass+7 : item.bass,when+i*beat,beat*.7,false,.13));
      if (metro) for (let i=0;i<beats;i++) AppAudio.clickSound(i===0,when+i*beat,scope);
      if (chords) {
        const pattern = ['Swing','Jazz'].includes(style) ? [0,beat+swingDelay,Math.min(beats-.4,3)*beat] :
          style === 'Bossa Nova' ? [0,swingDelay,Math.min(beats-.4,2)*beat] :
          style === 'Funk' ? [0,swingDelay,Math.min(beats-.4,2.5)*beat] : [0, Math.min(beats-.4,2)*beat];
        [...new Set(pattern)].filter(offset => offset < duration-.03).forEach(offset =>
          item.chord.forEach((midi,i) => voice(audio,midi,when+offset+i*.006,Math.min(beat*.62,duration-offset),true,.065)));
      }
      next = when + duration;
      index++;
      if (index === bars.length) {
        if (loop) index = 0;
        else {
          timer = setTimeout(() => { stop(); status('伴奏已结束'); }, Math.max(0,(next-audio.currentTime)*1000));
          return;
        }
      }
      timer = setTimeout(bar,Math.max(0,(next-audio.currentTime-.03)*1000));
    };
    bar();
  }

  function label(cell, root, scale, labelType) {
    if (!cell.tone) return '';
    const { tone } = cell;
    if (labelType === 'name') return tone.name;
    if (labelType === 'finger') return cell.finger || '';
    if (labelType === 'dot' || labelType === 'root' || labelType === 'target') return '';
    const raw = tone.interval;
    let degree = raw;
    if (state.sol === 'relative' && (labelType === 'sol' || labelType === 'degree')) {
      const relation = S.relative(scale);
      if (relation) {
        const shiftToParent = S.mod(relation.pitch - H.semitones(String(relation.degree)) + 6) - 6;
        const parentInterval = (shiftToParent < 0 ? 'b'.repeat(-shiftToParent) : '#'.repeat(shiftToParent)) + relation.degree;
        const reference = H.readRoot(H.spell(root, parentInterval));
        // Compare the written note letters against the relative major's seven degrees.
        const letter = 'CDEFGAB'.indexOf(tone.name[0]);
        const step = ((letter - 'CDEFGAB'.indexOf(reference.letter) + 7) % 7) + 1;
        const expected = H.semitones(String(step)), actual = S.mod(tone.pc - reference.pc);
        const shift = S.mod(actual-expected+6)-6;
        degree = (shift < 0 ? 'b'.repeat(-shift) : '#'.repeat(shift)) + step;
      }
    }
    if (labelType === 'sol') {
      const interval = S.degree(degree);
      return degree.replace(/\d+/, ['Do','Re','Mi','Fa','Sol','La','Si'][(interval-1)%7]);
    }
    return S.printable(degree);
  }

  function fretboard(region, root, scale, opts = {}) {
    const display = opts.labels || state.labels;
    const vertical = opts.orientation === 'vertical';
    const quiz = opts.quiz || false;
    const {from,to,cells} = region;
    const strings = [...new Set(cells.map(cell => cell.string))].sort((a,b) => vertical ? b-a : a-b);
    const count = to - from + 1;
    const long = count > 9 && !vertical;
    const target = new Set(opts.targets || []);
    const structure = opts.kind || 'point';
    const axis = Array.from({length:count},(_,i)=>from+i);
    const decorate = (cell, code) => {
      const d = cell.tone && S.degree(cell.tone.interval);
      const hint = display !== 'hide' && (!quiz || opts.reveal);
      const shown = (cell.tone && hint && display !== 'root' && display !== 'target') ||
        (hint && display === 'root' && d === 1) || (hint && display === 'target' && target.has(S.mod(cell.midi)));
      let tone = 'other';
      if (d === 1) tone='root';
      else if (cell.tone?.featured) tone='feature';
      else if (d === 3) tone='third';
      else if (d === 5) tone='fifth';
      else if (d === 7) tone='seventh';
      const choice = opts.picks?.has(code);
      const marked = opts.common?.has(S.mod(cell.midi));
      const title = `${cell.string} 弦 ${cell.fret} 品${shown ? ' · '+(cell.tone?.name || I.noteName(cell.midi)) : ''}`;
      const available = shown || quiz || !opts.compact;
      return available ? `<button type="button" data-ss-action="${structure}" data-value="${code}"
        class="ss-cell ${shown ? 'hit ' + tone : ''} ${choice ? 'pick' : ''} ${marked ? 'shared' : ''}"
        aria-label="${escape(title)}">${shown ? escape(label(cell,root,scale,display) || '•') : quiz ? '·' : ''}</button>` :
        '<span class="ss-cell empty"></span>';
    };
    const items = new Map(cells.map(cell => [I.key(cell),cell]));
    const cell = (string,fret) => {
      const code = `${string}:${fret}`;
      return decorate(items.get(code) || I.coordinate(string,fret),code);
    };
    return `<div class="ss-board-frame ${long ? 'ss-long' : ''}"><div class="ss-board ${vertical ? 'vertical' : ''}"
      style="--ss-cols:${vertical ? strings.length+1 : count+1}">
      <span class="ss-axis">${vertical ? '品' : '弦'}</span>
      ${(vertical ? strings : axis).map(n => `<span class="ss-axis">${n}</span>`).join('')}
      ${(vertical ? axis : strings).map(n => `<span class="ss-axis">${n}</span>${
        (vertical ? strings : axis).map(m => vertical ? cell(m,n) : cell(n,m)).join('')}`).join('')}
    </div></div>`;
  }

  const root = () => H.readRoot(state.key);
  const scale = () => S.byId.get(state.scale);
  function currentNotes() { return S.tones(root(),scale(),state.direction === 'down'); }
  function collectionPositions(notes, layout = state.layout, tonic = root(), descriptor = scale()) {
    const from = I.clamp(state.from), to = Math.min(24,Math.max(from, I.clamp(state.to)));
    if (layout === 'full') return [I.region(notes,0,24,'全指板')];
    if (layout === 'single') return [I.region(notes,0,24,state.string+' 弦', [state.string])];
    if (layout === 'custom') return [I.region(notes,from,to,from+'–'+to+' 品')];
    if (layout === 'start') return I.starts(tonic,notes,state.string);
    if (layout === 'three' || layout === 'two') return I.perString(notes,layout==='three'?3:2,state.string);
    if (descriptor && !S.relative(descriptor)) return [];
    return I.caged(tonic,notes);
  }

  function catalogue() {
    const meta = scale(), noteList = currentNotes(), tonic = root();
    const groups = S.groups[meta.group];
    const pitches = noteList.map(note=>note.pitch);
    const intervals = pitches.map((pitch,i)=>(pitches[i+1] ?? 12)-pitch)
      .map(n=>n===1?'半':n===2?'全':n===3?'增二':n+'半音');
    const shown = collectionPositions(noteList);
    const opts = {orientation:state.orientation, targets:I.material(tonic,H.types.get(state.chord)).map(n=>n.pc), compact:true};
    const hidden = state.labels === 'hide';
    return `<div class="ss-row">${select('layout','指型',shapes.map(([id,zh])=>option(id,zh,state.layout)).join(''))}
      ${select('labels','标记',labels.map(([id,zh])=>option(id,zh,state.labels)).join(''))}
      ${select('sol','首调基准',option('relative','关系大调',state.sol)+option('tonic','当前主音 Do / 1',state.sol))}
      ${select('orientation','图形',option('vertical','纵向',state.orientation)+option('horizontal','横向',state.orientation))}
      ${select('string','起始 / 单弦', [6,5,4,3,2,1].map(n=>option(n,`${n}弦`,state.string)).join(''))}
      ${state.layout==='custom' ? `<label>起品<input type="number" min="0" max="24" value="${state.from}" data-ss="from"></label><label>止品<input type="number" min="0" max="24" value="${state.to}" data-ss="to"></label>` : ''}
      ${state.labels==='target' ? select('chord','目标和弦',chordOptions(state.chord)) : ''}
      ${meta.id==='classical-minor' ? select('direction','方向',option('up','上行',state.direction)+option('down','下行',state.direction)) : ''}
      ${action('columns',state.single?'双列':'单列大图')}${action('color',state.color?'关闭颜色':'开启颜色')}${action('scale-play','试听音阶')}
    </div>
    <article class="ss-card ss-meta"><h3>${escape(tonic.name+' '+meta.zh)} <small>${escape(meta.en)}</small></h3>
      ${!hidden ? `<p><b>公式</b> ${noteList.map(n=>S.printable(n.interval)).join(' · ')}　<b>步距</b> ${intervals.join(' · ')}</p>
      <p><b>构成音</b> ${noteList.map(n=>n.name).join(' · ')}　<b>特征音</b> ${noteList.filter(n=>n.featured).map(n=>n.name).join(' · ')||'—'}</p>
      <p><b>适用和弦</b> ${meta.chords.filter(id=>id||meta.id==='major-pent'||meta.id==='major-blues'||meta.id==='double-harmonic').map(id=>escape(tonic.name+H.suffixLabel(id))).join(' · ')||'先选择目标音作背景'}　<b>风格</b> ${groups[1]}</p>
      <p><b>使用</b> ${escape(meta.usage)}　<b>练法</b> ${groups[2]}</p>` : ''}
      <p><b>常混淆</b> ${S.related(meta).map(o=>action('choose-scale',o.zh,o.id)).join(' ')}
      ${meta.aliases.length?`<small>别名 ${escape(meta.aliases.join(' / '))}</small>`:''}</p>
      ${progressLevel('scale:'+meta.id)}
    </article>
    ${state.layout!=='full' ? `<details class="ss-card"><summary>全指板分布 0–24 品</summary>${fretboard(I.region(noteList,0,24,'全指板'),tonic,meta,{...opts,orientation:'horizontal'})}</details>`:''}
    <div class="ss-grid ${state.single?'single':''}">${shown.map((region,i)=>{
      const next = shown[i+1];
      const shared = next && (state.layout==='caged'||state.layout==='cross') ? I.overlap(region,next) : [];
      const route = next && state.layout==='cross' ? I.crossRoute(region,next) : [];
      return `<article class="ss-card"><h4>${region.label}<small>${region.from}–${region.to} 品</small></h4>
        ${fretboard(region,tonic,meta,{...opts,orientation:['full','single'].includes(state.layout)?'horizontal':state.orientation})}
        ${shared.length&&!hidden?`<p>与下一型重叠 ${[...new Set(shared.map(n=>n.tone.name))].join(' · ')}</p>`:''}
        ${route.length&&!hidden?`<p>连接 ${route.map(n=>`${n.string}弦${n.fret}品`).join(' → ')} ${action('route','试听',route.map(n=>n.midi).join(','))}</p>`:''}
        <div class="ss-row">${action('zoom','放大',i)}${action('shape-play','试听指型',i)}</div></article>`;
    }).join('') || '<p class="ss-card">此音阶或音域没有合适的该类指型。可以改用全指板、自定义或单弦。</p>'}</div>`;
  }

  function progressLevel(id) {
    return `<label class="ss-progress-level">掌握阶段<select data-ss-progress="${escape(id)}">${steps.map((label,i)=>option(i,label,store.progress[id]||0)).join('')}</select></label>`;
  }

  const output = () => get('output');
  function render() {
    shell.classList.toggle('ss-monochrome',!state.color);
    shell.querySelectorAll('[data-ss-action="page"]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.value===state.page)));
    get('key').value = state.key;
    get('scale').value = state.scale;
    get('global-scale').hidden = !['atlas','compare','memory'].includes(state.page);
    output().innerHTML = state.page === 'atlas' ? catalogue() : modules.get(state.page)?.render() || '';
  }
  function go(page) {
    if (!pages.some(([id])=>id===page)) return;
    stop();
    state.page = page;
    status('');
    render();
  }

  shell.innerHTML = `<main class="ss-shell"><header class="ss-head"><button type="button" class="outline" data-page="menu">← 返回工具箱</button>
    <h2>吉他音阶与即兴</h2>${action('stop','停止播放')}</header>
    <div class="ss-sticky"><nav aria-label="吉他训练模块">${pages.map(([page,label])=>action('page',label,page)).join('')}</nav>
    <div class="ss-row">${select('key','调性',rootOptions(state.key))}
      <span data-ss="global-scale">${select('scale','音阶',scaleOptions(state.scale))}</span></div></div>
    <p data-ss="status" role="status" class="ss-status"></p><div data-ss="output"></div>
    <dialog data-ss="dialog"><button type="button" data-ss-action="close">关闭</button><div data-ss="zoom"></div></dialog></main>`;
  updatePalette();
  shell.addEventListener('change', event => {
    const input = event.target, name = input.dataset.ss;
    if (input.dataset.ssProgress) { store.progress[input.dataset.ssProgress] = Number(input.value); persist(); return; }
    if (Object.hasOwn(state,name)) {
      stop();
      state[name] = input.type==='number'||name==='string'?Number(input.value):input.value;
      if (name==='scale') state.direction='up';
      modules.get(state.page)?.reset?.();
      render();
    } else modules.get(state.page)?.change?.(input);
  });
  shell.addEventListener('click', event => {
    const target = event.target.closest('[data-ss-action]');
    if (!target) return;
    const name = target.dataset.ssAction, value = target.dataset.value;
    if (name==='page') return go(value);
    if (name==='stop') {stop(); status('播放已停止'); return;}
    if (name==='close') { get('dialog').close(); return; }
    if (name==='point') {
      const [string,fret] = value.split(':').map(Number);
      play([I.coordinate(string,fret)]); return;
    }
    if (name==='choose-scale') {state.scale=value; state.direction='up'; render(); return;}
    if (name==='columns' || name==='color') {
      if (name==='columns') state.single=!state.single; else state.color=!state.color;
      render(); return;
    }
    if (name==='scale-play') {
      const notes = I.sequence(root(),currentNotes());
      if (state.direction==='down') notes.reverse();
      play(notes); return;
    }
    if (name==='route') {play(value.split(',').map(Number));return;}
    if (name==='shape-play' || name==='zoom') {
      const region = collectionPositions(currentNotes())[Number(value)];
      if (name==='zoom') return zoom(region,root(),scale(),{orientation:state.orientation});
      play(region.cells.filter(n=>n.tone).sort((a,b)=>a.midi-b.midi)); return;
    }
    modules.get(state.page)?.action?.(name,value,target);
  });
  shell.addEventListener('submit', event => { event.preventDefault(); modules.get(state.page)?.submit?.(event.target); });
  function zoom(region, tonic, meta, options = {}) {
    get('zoom').innerHTML = `<h3>${escape(region.label)}</h3>${fretboard(region,tonic,meta,options)}`;
    get('dialog').showModal();
  }
  window.addEventListener('musictoolbox:stopaudio', () => {
    stop();
    if (get('dialog').open) get('dialog').close();
  });

  Object.assign(controller,{H,S,I,state,root,scale,currentNotes,getStore,persist,saveRecord,replaceStore,updatePalette,escape,option,action,select,
    scaleOptions,rootOptions,chordOptions,progressLevel,steps,collectionPositions,fretboard,zoom,play,backing,stop,status,render,go,output,
    register:(id,module)=>modules.set(id,module)});
  window.HetianScaleStudio = controller;
  document.getElementById('chordScaleStudio')?.addEventListener('click', () => {
    const source = app.chordAudio.currentChordName();
    if (!source) return;
    const found = H.readRoot(source.match(/^[A-G][#♯b♭]*/i)?.[0] || '');
    app.showPage('scaleStudio');
    window.dispatchEvent(new CustomEvent('haitang:scale-progression', {
      detail: {source, key:found?.name, mode:'major'},
    }));
  });
  window.addEventListener('musictoolbox:pagechange', event => {
    if (event.detail?.id !== 'scaleStudio') return;
    render();
  });
})();
