(() => {
  'use strict';

  const harmony = window.HetianChordLibrary;
  const app = window.HetianApp;
  if (!app?.chordAudio) return;
  const { getAudio, stopAllAudio } = app;
  const { stopChordProgression, stopAudioScope, voice, clickSound } = app.chordAudio;
  const shell = document.querySelector('#chordFinder .chord-shell');
  if (!harmony || !shell) return;

  const access = document.createElement('button');
  access.type = 'button';
  access.className = 'outline cl-entry';
  access.textContent = '吉他指型图鉴与练习 →';
  access.setAttribute('aria-expanded', 'false');
  access.setAttribute('aria-controls', 'chordLibraryPanel');
  shell.querySelector('.chord-head').after(access);

  const panel = document.createElement('section');
  panel.id = 'chordLibraryPanel';
  panel.hidden = true;
  panel.className = 'cl-panel';
  const button = (action, title, value = '') =>
    `<button type="button" data-cl-action="${action}" data-value="${value}">${title}</button>`;
  const rootStrings = [6, 5, 4];
  const attacks = [
    { id: 'strum', label: '扫弦', spacing: .038 },
    { id: 'block', label: '柱式和弦', spacing: 0 },
    { id: 'slow', label: '慢速扫弦', spacing: .12 },
  ];
  const directions = [
    '单独的 37、513、46/9 读作一个和弦，首位是级数，其余是后缀。没有合法后缀的 4536251、1645、251 按数字逐级拆开。',
    '用空格、连字符或小节线分隔和弦。要逐级弹 5、1、3，输入“5 1 3”。',
    '数字单级默认使用当前大小调的调内三和弦。罗马数字用大写表示大三和弦，小写表示小三和弦，° 表示减和弦。',
    '小调默认用自然小调定级。需要和声小调的属七时写 57，升七级用 ♯7。输入实际和弦名后切调，也会按原级数移调。',
  ];
  panel.innerHTML = `
    <header class="cl-heading">
      <h3 tabindex="-1">高级吉他和弦指型库</h3>
      ${button('close', '返回常用查询')}
    </header>
    <div class="cl-sticky">
      <nav class="cl-tabs" aria-label="和弦学习模式">
        ${button('tab', '指型图鉴', 'atlas')}${button('tab', '功能谱转换', 'convert')}${button('tab', '连接练习', 'practice')}
      </nav>
      <div class="cl-controls">
        <label><span data-cl="key-label">根音</span><select data-cl="key">${harmony.keys.map(key => `<option>${key}</option>`).join('')}</select></label>
        <label data-cl="mode-field">调式<select data-cl="mode"><option value="major">大调</option><option value="minor">小调</option></select></label>
        <fieldset class="cl-strings"><legend class="cl-sr">根音所在琴弦</legend>
          ${button('string', '全部', '0')}${button('string', '六弦', '6')}${button('string', '五弦', '5')}${button('string', '四弦', '4')}
        </fieldset>
      </div>
    </div>
    <div data-cl-view="atlas">
      <div class="cl-options">
        <label>和弦类别<select data-cl="family"><option value="">全部类别</option>${harmony.families.map(([family]) => `<option>${family}</option>`).join('')}</select></label>
        <label>和弦类型<select data-cl="type"><option value="all">全部类型</option>${[...harmony.types].map(([id]) => `<option value="${id}">${id ? harmony.suffixLabel(id) : "Major"}</option>`).join('')}</select></label>
        <label>图上标记<select data-cl="labels"><option value="interval">相对音程</option><option value="name">音名</option><option value="finger">指号</option></select></label>
        <label>学习记录<select data-cl="filter"><option value="">全部指型</option><option value="fav">已收藏</option><option value="learned">已掌握</option></select></label>
        ${button('layout', '单列大图')}
      </div>
      <div class="cl-legend" aria-label="颜色标记">
        <span class="cl-root">根音</span><span class="cl-third">三音</span><span class="cl-seventh">七音</span><span class="cl-extension">扩展音</span><span class="cl-other">其他音</span>
      </div>
      <details class="cl-rules"><summary>七、九、十一、十三和弦的特征音</summary>
        <ul><li>七和弦先找三音和七音。大七是 3 + 7，小七是 ♭3 + ♭7，属七是 3 + ♭7。</li>
        <li>九和弦在七和弦上加九音。add9 只有三和弦与九音。6/9 有六音和九音，十三和弦还带七音。</li>
        <li>十一和弦以 11 为特征。属十一的无三音指型保留 ♭7、9、11，和 9sus4 可以共用按法。挂留和弦用 2 或 4 替代三音。</li>
        <li>十三和弦保留七音和 13；普通 13 可省 9、11。后缀点名的 ♭9、♯9 或 ♯11 要保留。</li>
        <li>用 CAGED 先认七和弦骨架，再找不同根音弦上的扩展音。六个品位数字从六弦读到一弦。</li></ul>
      </details>
      <p class="cl-muted" data-cl="count" role="status"></p>
      <div data-cl="atlas"></div>
    </div>
    <div data-cl-view="convert" hidden>
      <form class="cl-form" data-cl="converter">
        <label>输入格式<select data-cl="format"><option value="auto">自动识别</option><option value="numeric">台湾功能谱</option><option value="roman">罗马数字</option><option value="absolute">实际和弦名</option></select></label>
        <label class="cl-grow">和弦进行<input data-cl="conversion-input" value="4maj9 – 513 – 3m9 – 6m9 – 2m9 – 57♭9 – 1maj9" spellcheck="false" autocapitalize="off" autocomplete="off"></label>
        <button type="submit">转换进行</button>
      </form>
      <p class="cl-muted" data-cl="convert-status" role="status"></p>
      <details class="cl-rules"><summary>数字与罗马数字如何解析</summary><ul>${directions.map(line => `<li>${line}</li>`).join('')}</ul></details>
      <div data-cl="conversion"></div>
      ${button('practice-conversion', '用这组和弦练习')}
    </div>
    <div data-cl-view="practice" hidden>
      <div class="cl-presets" aria-label="练习预设">
        ${harmony.presets.map((item, i) => button('preset', item.name, i)).join('')}
      </div>
      <form class="cl-form" data-cl="custom">
        <label class="cl-grow">练习进行<input data-cl="practice-input" value="${harmony.presets[0].source}" spellcheck="false" autocapitalize="off" autocomplete="off"></label>
        <button type="submit">应用自定义</button>
      </form>
      <div class="cl-transport">
        <label>速度 BPM<input data-cl="bpm" type="number" min="35" max="240" value="90" step="1"></label>
        <label>每个和弦<select data-cl="beats"><option value="1">1 拍</option><option value="2">2 拍</option><option selected value="4">4 拍</option></select></label>
        <label><input type="checkbox" data-cl="metro" checked>节拍器</label>
        <label><input type="checkbox" data-cl="loop" checked>循环</label>
        ${button('play', '▶ 播放')}${button('stop', '■ 停止')}
      </div>
      <p class="cl-muted" data-cl="practice-status" role="status"></p>
      <div data-cl="practice"></div>
    </div>
    <dialog class="cl-dialog" aria-labelledby="cl-detail-title">
      <header class="cl-heading"><h3 id="cl-detail-title"></h3>${button('dismiss', '关闭')}</header>
      <div data-cl="detail"></div>
    </dialog>`;
  shell.append(panel);

  const get = name => panel.querySelector(`[data-cl="${name}"]`);
  const storageKey = 'haitangChordLibraryV1';
  const records = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return { fav: new Set(Array.isArray(saved?.fav) ? saved.fav : []),
        learned: new Set(Array.isArray(saved?.learned) ? saved.learned : []),
        single: saved?.single === true };
    } catch (_) { return { fav: new Set(), learned: new Set(), single: false }; }
  })();
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ fav: [...records.fav], learned: [...records.learned], single: records.single })); }
    catch (_) { get('count').textContent += ' · 此设备的浏览器禁止本地保存'; }
  }

  const shapes = new Map();
  const dialog = panel.querySelector('dialog');
  let tab = 'atlas', rootString = 0, mode = 'major';
  let tonic = harmony.readRoot('C'), atlasRoot = harmony.readRoot('C');
  let activePicture = null, dialogTrigger = null, generation = 0, timer = 0;
  let conversion = null, practice = null, practiceRows = [];
  let preset = 0;
  const conversionChoices = new Map(), practiceChoices = new Map();
  const currentChoices = () => tab === 'convert' ? conversionChoices : practiceChoices;
  function changeChoice(index, change) {
    const choices = currentChoices();
    choices.set(index, { ...choices.get(index), ...change });
  }
  const scope = 'chord-library';
  const cls = interval => {
    const step = Number(interval.match(/\d+/)[0]);
    if (step === 1 || step === 3 || step === 7) return {1:'root', 3:'third', 7:'seventh'}[step];
    return [6,9,11,13].includes(step) ? 'extension' : 'other';
  };

  function diagram(shape, labels, large = false) {
    const frets = shape.frets.filter(fret => fret > 0);
    const start = shape.frets.includes(0) && Math.max(...frets) <= 4 ? 1 : Math.min(...frets);
    const x = i => 34 + i * 29;
    const y = fret => 32 + (fret - start + .5) * 26;
    const last = 32 + 26 * 4;
    const grid = Array.from({length: 6}, (_, i) => `<path d="M${x(i)} 32V${last}"/>`).join('') +
      Array.from({length: 5}, (_, i) => `<path d="M${x(0)} ${32+i*26}H${x(5)}" ${i === 0 && start === 1 ? 'class="cl-nut"' : ''}/>`).join('');
    const barre = shape.barres.map(({fret, from, to}) =>
      `<path class="cl-barre" d="M${x(from)} ${y(fret)}H${x(to)}"/>`).join('');
    const notes = shape.frets.map((fret, index) => {
      const note = shape.notes.find(item => item.string === 6 - index);
      const at = x(index);
      const label = note ? {interval: harmony.suffixLabel(note.interval), name: note.name,
        finger: shape.fingers[index] || '○'}[labels] : '';
      const marker = fret < 0 ? `<text x="${at}" y="18">×</text>` :
        `<g class="cl-${cls(note.interval)} cl-dot"><circle cx="${at}" cy="${fret === 0 ? 15 : y(fret)}" r="11"/><text x="${at}" y="${fret === 0 ? 15 : y(fret)}" dominant-baseline="central">${fret === 0 ? '○' : label}</text></g>`;
      return marker + `<text x="${at}" y="151" class="cl-string-no">${6 - index}</text>` +
        (fret === 0 && labels !== 'finger' ? `<text x="${at}" y="174" class="cl-string-no">${label}</text>` : '');
    }).join('');
    return `<svg class="cl-svg${large ? ' cl-big' : ''}" viewBox="0 0 200 182" role="img" aria-label="从六弦到一弦，品位 ${shape.frets.map(fret => fret < 0 ? '静音' : fret).join('、')}">
      <g class="cl-grid-lines">${grid}</g>${barre}<text x="14" y="51">${start}品</text>${notes}</svg>`;
  }

  function shapeSummary(shape) {
    const entries = [];
    if (shape.thirdlessEleventh) entries.push('无三音 · 也可作 9sus4');
    if (shape.changes.length) entries.push('变化音 ' + shape.changes.map(harmony.suffixLabel).join(' · '));
    if (shape.omitted.length) entries.push('省略 ' + shape.omitted.map(harmony.suffixLabel).join(' · '));
    if (shape.barres.length) entries.push('横按 ' + shape.barres.map(barre =>
      `${barre.fret}品 ${6-barre.from}–${6-barre.to}弦`).join('、'));
    return entries.join(' / ');
  }

  function card(shape, name, practiceStyle = null, index = 0) {
    const key = 'shape:' + shape.id;
    shapes.set(key, { shape, name });
    return `<article class="cl-card">
      <button class="cl-picture" type="button" data-cl-action="zoom" data-value="${key}" aria-label="放大 ${name} ${shape.rootString}弦根音">
        <b>${name}</b><small>${shape.rootString}弦根音</small>${diagram(shape, get('labels').value)}
      </button>
      <p>${shapeSummary(shape) || '完整构成音'}</p>
      <div class="cl-frets" aria-label="六弦至一弦实际品位">${shape.frets.map(fret => fret < 0 ? '×' : fret).join(' · ')}</div>
      <div class="cl-card-actions">
        ${practiceStyle ? `<div class="cl-play-options">
          ${button('preview', '▶ 试听', key)}
          <select aria-label="第 ${index + 1} 个和弦的演奏方式" data-cl-attack="${index}">
            ${attacks.map(({id, label}) => `<option value="${id}" ${id === practiceStyle ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>` : button('preview', '▶ 扫弦', key)}
        <button type="button" aria-label="收藏指型" aria-pressed="${records.fav.has(shape.id)}" data-cl-action="fav" data-value="${key}">${records.fav.has(shape.id) ? '★' : '☆'}</button>
        <button type="button" aria-label="标记已掌握" aria-pressed="${records.learned.has(shape.id)}" data-cl-action="learned" data-value="${key}">✓</button>
      </div>
    </article>`;
  }

  const strings = () => rootString ? [rootString] : rootStrings;
  function catalogue() {
    const root = atlasRoot;
    const family = get('family').value;
    const filter = get('filter').value;
    const typeFilter = get('type').value;
    let count = 0, countTypes = 0;
    const output = harmony.families.filter(([name]) => typeFilter !== 'all' || !family || name === family).map(([name, entries]) => {
      const tiles = entries.filter(([id]) => typeFilter === 'all' || typeFilter === id).map(([id]) => {
        const type = harmony.types.get(id);
        const name = root.name + harmony.suffixLabel(id);
        const options = strings().flatMap(string => harmony.voicings(root, type, string))
          .filter(shape => !filter || records[filter].has(shape.id));
        if (filter && !options.length) return '';
        const missing = strings().filter(string => !options.some(shape => shape.rootString === string));
        count += options.length;
        countTypes++;
        return `<section class="cl-type">
          <div class="cl-type-title"><h5>${name}</h5><span>${id === '7alt'
            ? '1 · 3 · ♭7 + 变化五音或九音'
            : type.tones.map(tone => harmony.suffixLabel(tone.interval)).join(' · ')}</span></div>
          <div class="cl-grid">${options.map(shape => card(shape, name)).join('')}</div>
          ${missing.length && !filter ? `<p class="cl-muted">${missing.join('、')}弦根音暂无合适指型</p>` : ''}
        </section>`;
      }).join('');
      return tiles ? `<section class="cl-family"><h4>${name}</h4>${tiles}</section>` : '';
    }).join('');
    get('atlas').innerHTML = output || '<p class="cl-empty">当前筛选下没有学习记录。</p>';
    get('count').textContent = `${countTypes} 种和弦 · ${count} 个指型 · 已收藏 ${records.fav.size} · 已掌握 ${records.learned.size}`;
  }

  function detail(entry) {
    const { shape, name } = entry;
    const key = 'shape:' + shape.id;
    dialog.querySelector('h3').textContent = `${name} · ${shape.rootString}弦根音`;
    get('detail').innerHTML = `${diagram(shape, get('labels').value, true)}
      <p class="cl-muted">${shapeSummary(shape) || '完整构成音'}</p>
      <div class="cl-detail-notes">${shape.notes.map(note => `<button type="button" class="cl-${cls(note.interval)}" data-cl-action="note" data-value="${note.string}">
        <b>${note.name}${note.octave} · ${harmony.suffixLabel(note.interval)}</b>
        <small>${note.string}弦 · ${note.fret ? `${note.fret}品 / ${shape.fingers[6-note.string]}指` : '空弦'}</small></button>`).join('')}</div>
      <div class="cl-options">
        ${button('preview','▶ 扫弦',key)}${button('arpeggio','▶ 分解',key)}
        ${button('fav', records.fav.has(shape.id) ? '★ 已收藏' : '☆ 收藏', key)}
        ${button('learned', records.learned.has(shape.id) ? '✓ 已掌握' : '标记已掌握', key)}
      </div>`;
  }

  function preferred(options, previous) {
    return options.reduce((best, shape) => {
      const cost = harmony.connection(previous, shape) + shape.score * (previous ? .15 : 1);
      return !best || cost < best.cost ? {shape, cost} : best;
    }, null)?.shape;
  }
  function progressionRows(items, choices, practiceMode = false) {
    let previous = null;
    return (items || []).map((item, index) => {
      const chord = harmony.resolve(item, tonic, mode);
      const byString = new Map(rootStrings.map(string => [string, harmony.voicings(chord.root, chord.type, string)]));
      const choice = choices.get(index);
      const wanted = choice?.string ?? rootString;
      const options = wanted ? byString.get(wanted) : [...byString.values()].flat();
      const hand = options.find(shape => shape.id === choice?.shape) || preferred(options, previous);
      const position = shape => Math.min(...shape.frets.filter(fret => fret >= 0));
      const movement = previous && hand ? Math.abs(position(hand) - position(previous)) : null;
      if (practiceMode) previous = hand;
      return { chord, byString, options, hand, wanted, movement, attack: choice?.attack || 'strum' };
    });
  }

  function progressionCard({chord, byString, options, hand, wanted, movement, attack}, i, practiceMode) {
    const shown = hand?.rootString ?? wanted;
    const name = `${i + 1}. ${chord.name}`;
    return `<section class="cl-step" data-cl-step="${i}">
      <div class="cl-notation"><b>${practiceMode ? name : chord.name}</b><span>${chord.numeric} · ${chord.roman}</span></div>
      <div class="cl-step-strings" role="group" aria-label="${name} 的根音弦">
        ${rootStrings.map((string, j) => {
          const playable = byString.get(string).length > 0;
          return `<button type="button" data-cl-action="step-string" data-value="${string}"
            aria-pressed="${shown === string}" ${playable ? '' : 'disabled title="此弦暂无合适指型"'}>${['六','五','四'][j]}弦</button>`;
        }).join('')}
      </div>
      ${hand ? `${card(hand, chord.name, practiceMode ? attack : null, i)}
        <label class="cl-choice">换用指型<select data-cl-choice="${i}" aria-label="${name} 换用指型">
          ${options.map(shape => `<option value="${shape.id}" ${shape === hand ? 'selected' : ''}>${shape.rootString}弦 · ${shape.frets.map(fret => fret < 0 ? '×' : fret).join(' ')}</option>`).join('')}
        </select></label>
        ${movement === null ? '' : `<small class="cl-muted">${movement ? `换把 ${movement} 品` : '同把位连接'}</small>`}`
        : `<p class="cl-muted">暂无合适指型${practiceMode ? ' · 播放时保留拍点' : ''}</p>`}
    </section>`;
  }

  function renderProgression(name, rows, practiceMode = false) {
    get(name).innerHTML = rows.length
      ? `<div class="cl-grid">${rows.map((row, index) => progressionCard(row, index, practiceMode)).join('')}</div>`
      : '';
  }

  function conversionCards() {
    renderProgression('conversion', progressionRows(conversion, conversionChoices));
  }

  function parseConversion() {
    const status = get('convert-status');
    conversionChoices.clear();
    try {
      conversion = harmony.parse(get('conversion-input').value, tonic, mode, get('format').value);
      status.textContent = `已转换 ${conversion.length} 个和弦 · ${tonic.name}${mode === 'major' ? '大调' : '小调'}`;
    } catch (error) {
      conversion = null;
      status.textContent = error.message;
    }
    panel.querySelector('[data-cl-action="practice-conversion"]').disabled = !conversion;
    paint();
  }

  function practiceCards() {
    practiceRows = progressionRows(practice, practiceChoices, true);
    renderProgression('practice', practiceRows, true);
    panel.querySelector('[data-cl-action="play"]').disabled = !practiceRows.length;
  }

  function loadPractice(source, selectedPreset = null) {
    const status = get('practice-status');
    stop();
    practiceChoices.clear();
    try {
      practice = harmony.parse(source, tonic, mode);
      preset = selectedPreset;
      status.textContent = `${practice.length} 个和弦 · 可逐个切换根音弦、指型和演奏方式`;
    } catch (error) {
      practice = null;
      preset = null;
      status.textContent = error.message;
    }
    paint();
  }

  function paint() {
    shapes.clear();
    get('key').value = (tab === 'atlas' ? atlasRoot : tonic).name;
    get('key-label').textContent = tab === 'atlas' ? '根音' : '调性';
    get('mode').value = mode;
    get('mode-field').hidden = tab === 'atlas';
    panel.classList.toggle('cl-single', records.single);
    panel.querySelector('[data-cl-action="layout"]').textContent = records.single ? '恢复网格' : '单列大图';
    panel.querySelectorAll('[data-cl-view]').forEach(view => { view.hidden = view.dataset.clView !== tab; });
    for (const [action, value] of [['tab',tab],['string',String(rootString)],['preset',String(preset)]]) {
      panel.querySelectorAll(`[data-cl-action="${action}"]`).forEach(control => {
        control.setAttribute('aria-pressed', String(control.dataset.value === value));
      });
    }
    if (tab === 'atlas') catalogue();
    if (tab === 'convert') conversionCards();
    if (tab === 'practice') practiceCards();
    if (activePicture && dialog.open) detail(activePicture);
  }

  function show(next) {
    stopChordProgression('');
    stop();
    tab = next;
    if (tab === 'convert' && !conversion) parseConversion();
    else if (tab === 'practice' && !practice) loadPractice(get('practice-input').value, preset);
    else paint();
  }

  function stop(fromApp = false) {
    generation++;
    clearTimeout(timer);
    panel.querySelectorAll('[data-cl-step].cl-playing').forEach(step => step.classList.remove('cl-playing'));
    if (fromApp) return;
    stopAudioScope(scope);
    window.HetianGuitar?.stopAll();
  }

  async function startAudio() {
    stopChordProgression('');
    stop();
    const current = generation;
    const audio = getAudio();
    try { await audio.resume(); }
    catch (_) { return null; }
    if (current !== generation) return null;
    let sampled = Boolean(window.HetianGuitar);
    try { if (sampled) await window.HetianGuitar.prepareSamples(audio); }
    catch (_) { sampled = false; }
    return current === generation ? { audio, sampled, current } : null;
  }

  function playNotes(sound, notes, time, spacing, duration) {
    notes.forEach((note, i) => {
      const start = time + i * spacing;
      if (sound.sampled) window.HetianGuitar.playSample(sound.audio, note.midi, start, duration, notes.length > 1 ? .37 : .65, note.stringMidi);
      else voice(note.midi, start, duration, 'guitar', .20, scope);
    });
  }
  async function preview(notes, spacing) {
    const sound = await startAudio();
    if (sound && notes.length) playNotes(sound, notes, sound.audio.currentTime + .035, spacing, 1.15);
  }
  async function playPractice() {
    if (!practiceRows.length) return;
    const sound = await startAudio();
    if (!sound) return;
    const bpm = Math.max(35, Math.min(240, Number(get('bpm').value) || 90));
    get('bpm').value = bpm;
    const beat = 60 / bpm;
    const beats = Number(get('beats').value);
    const total = practiceRows.length * beats;
    let tick = 0;
    let time = sound.audio.currentTime + .06;
    function next() {
      if (sound.current !== generation) return;
      if (tick === total) {
        if (!get('loop').checked) {
          timer = setTimeout(() => {
            stop();
            get('practice-status').textContent = '练习播放完成';
          }, Math.max(0, (time - sound.audio.currentTime) * 1000));
          return;
        }
        tick = 0;
      }
      time = Math.max(time, sound.audio.currentTime + .025);
      const downbeat = tick % beats === 0;
      if (get('metro').checked) clickSound(downbeat, time, scope);
      if (downbeat) {
        const index = Math.floor(tick / beats);
        const { chord, hand, attack } = practiceRows[index];
        panel.querySelector('.cl-step.cl-playing')?.classList.remove('cl-playing');
        panel.querySelector(`[data-cl-step="${index}"]`)?.classList.add('cl-playing');
        get('practice-status').textContent = `第 ${index + 1}/${practiceRows.length} 个和弦 · ${chord.name}`;
        if (hand) {
          const window = beat * beats * .84;
          const target = attack === 'strum' ? .022 : attacks.find(option => option.id === attack).spacing;
          const spacing = Math.min(target, window * .55 / Math.max(1, hand.notes.length - 1));
          playNotes(sound, hand.notes, time, spacing, Math.max(.12, window - spacing * (hand.notes.length - 1)));
        }
      }
      tick++;
      time += beat;
      timer = setTimeout(next, Math.max(0, (time - sound.audio.currentTime - .06) * 1000));
    }
    next();
  }

  function toggle(open) {
    if (open) stopAllAudio('chord-library');
    else {
      stop();
      if (dialog.open) dialog.close();
    }
    access.hidden = open;
    access.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    shell.classList.toggle('cl-open', open);
    if (open) {
      show(tab);
      panel.querySelector('.cl-heading h3').focus();
    } else access.focus();
  }

  access.onclick = () => toggle(true);
  panel.addEventListener('submit', event => {
    event.preventDefault();
    if (event.target === get('converter')) parseConversion();
    if (event.target === get('custom')) loadPractice(get('practice-input').value);
  });
  panel.addEventListener('change', event => {
    const control = event.target;
    const kind = control.dataset.cl;
    if (control.dataset.clChoice !== undefined) {
      const index = Number(control.dataset.clChoice);
      changeChoice(index, { shape: control.value });
      stop();
      paint();
      panel.querySelector(`[data-cl-view="${tab}"] [data-cl-choice="${index}"]`)?.focus({preventScroll:true});
    } else if (control.dataset.clAttack !== undefined) {
      const index = Number(control.dataset.clAttack);
      changeChoice(index, { attack: control.value });
      practiceRows[index].attack = control.value;
    } else if (kind === 'key' || kind === 'mode') {
      stop();
      if (tab === 'atlas') atlasRoot = harmony.readRoot(get('key').value);
      else {
        tonic = harmony.readRoot(get('key').value);
        mode = get('mode').value;
        if (tab === 'convert' && conversion) get('convert-status').textContent = `已转换 ${conversion.length} 个和弦 · ${tonic.name}${mode === 'major' ? '大调' : '小调'}`;
      }
      paint();
    } else if (kind === 'family' || kind === 'type') {
      if (kind === 'family') get('type').value = 'all';
      else if (control.value !== 'all') get('family').value = harmony.types.get(control.value).family;
      paint();
    } else if (['labels', 'filter'].includes(kind)) paint();
    else if (kind === 'format') parseConversion();
    else if (kind === 'bpm' || kind === 'beats') stop();
  });
  panel.addEventListener('click', event => {
    const target = event.target.closest('[data-cl-action]');
    if (!target) return;
    const {clAction: action, value} = target.dataset;
    const entry = shapes.get(value) || (dialog.open ? activePicture : null);
    switch (action) {
      case 'close': toggle(false); break;
      case 'tab': show(value); break;
      case 'string': rootString = Number(value); stop(); paint(); break;
      case 'step-string': {
        const index = Number(target.closest('[data-cl-step]').dataset.clStep);
        changeChoice(index, { string: Number(value), shape: null });
        stop();
        paint();
        panel.querySelector(`[data-cl-view="${tab}"] [data-cl-step="${index}"] [data-cl-action="step-string"][data-value="${value}"]`)?.focus({preventScroll:true});
        break;
      }
      case 'layout': records.single = !records.single; save(); paint(); break;
      case 'zoom':
        if (!entry) break;
        dialogTrigger = target;
        activePicture = entry;
        detail(entry);
        dialog.showModal();
        break;
      case 'dismiss': dialog.close(); break;
      case 'note':
        if (activePicture) preview(activePicture.shape.notes.filter(note => note.string === Number(value)), 0);
        break;
      case 'preview':
      case 'arpeggio':
        if (entry) {
          const attack = target.closest('.cl-play-options')?.querySelector('[data-cl-attack]')?.value;
          const spacing = action === 'arpeggio' ? .21 : attacks.find(option => option.id === attack)?.spacing ?? .038;
          preview(entry.shape.notes, spacing);
        }
        break;
      case 'fav':
      case 'learned':
        if (!entry) break;
        if (records[action].has(entry.shape.id)) records[action].delete(entry.shape.id);
        else records[action].add(entry.shape.id);
        save();
        if (tab === 'atlas' && get('filter').value && !dialog.open) paint();
        else {
          panel.querySelectorAll(`[data-cl-action="${action}"]`).forEach(control => {
            if (control.dataset.value !== value || dialog.contains(control)) return;
            const marked = records[action].has(entry.shape.id);
            control.setAttribute('aria-pressed', String(marked));
            if (action === 'fav') control.textContent = marked ? '★' : '☆';
          });
          if (tab === 'atlas') {
            get('count').textContent = get('count').textContent.replace(/已收藏 \d+ · 已掌握 \d+$/,
              `已收藏 ${records.fav.size} · 已掌握 ${records.learned.size}`);
          }
          if (dialog.open) {
            detail(entry);
            dialog.querySelector(`[data-cl-action="${action}"]`).focus();
          }
        }
        break;
      case 'preset': {
        const item = harmony.presets[Number(value)];
        mode = item.mode;
        get('practice-input').value = item.source;
        loadPractice(item.source, Number(value));
        break;
      }
      case 'practice-conversion':
        if (!conversion) break;
        practice = conversion.map(item => ({ ...item }));
        preset = null;
        practiceChoices.clear();
        conversionChoices.forEach((choice, index) => practiceChoices.set(index, { ...choice }));
        get('practice-input').value = conversion.map(item => harmony.resolve(item, tonic, mode).numeric).join(' ');
        get('practice-status').textContent = `已载入 ${practice.length} 个和弦`;
        show('practice');
        break;
      case 'play': playPractice(); break;
      case 'stop': stop(); get('practice-status').textContent = '练习已停止'; break;
    }
  });
  dialog.addEventListener('close', () => {
    activePicture = null;
    dialogTrigger?.focus();
    if (tab === 'atlas' && get('filter').value) paint();
  });
  window.addEventListener('musictoolbox:stopaudio', () => {
    stop(true);
    if (dialog.open) dialog.close();
  });
})();
