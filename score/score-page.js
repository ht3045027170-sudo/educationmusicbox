(() => {
  'use strict';
  const page = document.getElementById('scoreEditor');
  const NS = window.MusicScore;
  if (!page || !NS?.model || !NS?.storage || !NS?.renderers || !NS.PlaybackEngine) return;
  const { createScore, makeEvent, makePart, makeMeasure, migrateScore, findEvent, clone, INSTRUMENTS, midiName, uid } = NS.model;
  const esc = NS.renderers.esc;
  const style = document.createElement('style');
  style.textContent = `
  #scoreEditor{padding:0;background:#c9c9c6;color:#222;overflow:hidden;font:13px system-ui,-apple-system,"Segoe UI","PingFang SC",sans-serif}
  .sc-app{height:100vh;display:grid;grid-template-rows:34px 52px minmax(0,1fr) 42px;background:#d7d8d6}
  .sc-menubar,.sc-toolbar,.sc-tabs{display:flex;align-items:center;gap:5px;padding:0 9px;border-bottom:1px solid #90938f;background:#f4f5f3}
  .sc-brand{font-weight:850;color:#2b6c4d;margin-right:18px}.sc-menu{position:relative}.sc-menu>button{height:27px;border:0;background:transparent;padding:0 9px}.sc-menu>button:hover,.sc-menu.open>button{background:#dfe9e3}
  .sc-menu-list{display:none;position:absolute;z-index:90;top:29px;left:0;width:210px;padding:5px;border:1px solid #a8aca8;border-radius:7px;background:#fff;box-shadow:0 12px 35px #0004}.sc-menu.open .sc-menu-list{display:block}
  .sc-menu-list button{display:flex;width:100%;justify-content:space-between;padding:7px 9px;border:0;border-radius:4px;background:#fff;text-align:left}.sc-menu-list button:hover{background:#e4f1e9}.sc-menu-list button:disabled{opacity:.4}
  .sc-save-state{margin-left:auto;color:#66736c;font-size:11px}.sc-toolbar{gap:7px;background:linear-gradient(#fafbfa,#e5e7e4);overflow-x:auto}.sc-btn,.sc-select,.sc-input{height:32px;border:1px solid #aeb3ae;border-radius:6px;background:#fff;color:#253029;padding:0 9px}.sc-btn{cursor:pointer;white-space:nowrap}.sc-btn:hover,.sc-btn.on{border-color:#3e9369;background:#e4f3e9;color:#256244}.sc-btn.primary{background:#397d59;color:#fff;border-color:#286345}.sc-btn.danger{color:#a43b3b}.sc-divider{height:28px;border-left:1px solid #b7bbb7}.sc-work{min-height:0;display:grid;grid-template-columns:224px minmax(420px,1fr) 250px}
  .sc-left,.sc-right{min-height:0;overflow:auto;background:#eef0ed;border-right:1px solid #a9ada8}.sc-right{border-left:1px solid #a9ada8;border-right:0}.sc-panel-title{position:sticky;top:0;z-index:2;padding:10px 12px;background:#dde2de;border-bottom:1px solid #b5bab5;font-weight:800}
  .sc-palette details{border-bottom:1px solid #c8ccc8}.sc-palette summary{padding:9px 11px;cursor:pointer;font-weight:700}.sc-palette-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:0 9px 10px}.sc-palette-grid button{height:37px;border:1px solid #bec5c0;border-radius:6px;background:#fff;font-size:17px}.sc-palette-grid button.on{background:#3f8961;color:#fff}
  .sc-canvas{min-width:0;overflow:auto;padding:28px;background:#b7b9b6}.sc-paper{position:relative;width:min(1060px,100%);min-height:850px;margin:auto;padding:34px 34px 54px;background:#fff;box-shadow:0 6px 26px #0004;transform-origin:top center}.sc-canvas.continuous{padding:0}.sc-canvas.continuous .sc-paper{width:100%;max-width:none;min-height:100%;box-shadow:none}.sc-title{text-align:center;margin-bottom:26px}.sc-title h1{font:700 28px Georgia,serif;margin:0}.sc-title p{margin:6px 0;color:#666}.sc-score-svg{display:block;width:100%;height:auto;overflow:visible}.sc-score-svg line{stroke:#252525;stroke-width:1}.score-clef{font:42px "Bravura","Noto Music","Segoe UI Symbol",serif}.score-meter{font:bold 16px Georgia}.key-signature{font:21px "Noto Music","Segoe UI Symbol",serif}.score-part-label{font:bold 14px system-ui}.measure-number{font-size:9px;fill:#777}.score-event{cursor:pointer}.score-note ellipse.filled{fill:#151515}.score-note ellipse.open{fill:#fff;stroke:#111;stroke-width:1.5}.stem{stroke-width:1.4!important}.flag{fill:none;stroke-width:2!important}.ledger{stroke-width:1.2!important}.score-event.selected ellipse,.score-rest.selected{stroke:#0a8f55!important;stroke-width:3!important;fill:#71d69f!important}.score-note-preview{opacity:.56}.score-note-preview .preview-head{fill:#2faf70;stroke:#19794a;stroke-width:1.2}.score-note-preview .preview-stem{stroke:#19794a!important;stroke-width:1.7!important}.score-note-preview .preview-accidental{fill:#19794a}.accidental{font-size:18px}.score-rest{font:25px "Noto Music","Segoe UI Symbol";cursor:pointer}.score-chord{font:bold 13px Georgia;fill:#245a42}.score-function{font:italic 12px Georgia;fill:#6f4385}.score-lyric{font-size:11px}.numbered-note{font:bold 16px system-ui}.number-line,.number-baseline{stroke-width:1!important}.notation-label{font-size:10px;fill:#777}.tab-line{stroke:#666!important;stroke-width:.7!important}.tab-number-bg{fill:#fff}.tab-number{font:bold 9px Consolas}.barline{stroke-width:1.5!important}
  .sc-properties{padding:12px}.sc-properties h3{margin:3px 0 13px}.sc-field{display:block;margin:10px 0;color:#5d6961;font-size:11px}.sc-field input,.sc-field select,.sc-field textarea{display:block;width:100%;margin-top:4px;padding:7px;border:1px solid #b9c0ba;border-radius:6px;background:#fff}.sc-field textarea{min-height:58px;resize:vertical}.sc-inline{display:grid;grid-template-columns:1fr 1fr;gap:7px}.sc-part-list{display:grid;gap:5px;margin-top:10px}.sc-part{display:grid;grid-template-columns:7px 1fr 29px 29px;gap:5px;align-items:center;padding:7px;border:1px solid #c3c9c4;border-radius:6px;background:#fff}.sc-part.active{border-color:#36865e;background:#e8f4ec}.sc-part i{height:30px;background:#4b956d}.sc-mini{height:27px;border:1px solid #adb6af;background:#fff;border-radius:5px}.sc-mini.on{background:#3c825c;color:#fff}
  .sc-tabs{border-top:1px solid #9a9e9a;border-bottom:0;background:#e8ebe8;overflow-x:auto}.sc-tabs button{height:31px;border:0;border-bottom:3px solid transparent;background:transparent;white-space:nowrap}.sc-tabs button.on{border-color:#367f59;color:#286245;font-weight:750}.sc-play-cursor{display:none;position:absolute;z-index:8;width:3px;background:#e25451;box-shadow:0 0 7px #f44;pointer-events:none}
  .sc-dialog{position:fixed;inset:0;z-index:10020;display:grid;place-items:center;padding:15px;background:#15221bbb;backdrop-filter:blur(5px)}.sc-dialog.hidden{display:none}.sc-dialog-card{width:min(720px,96vw);max-height:90vh;overflow:auto;padding:22px;border-radius:18px;background:#f8faf8;box-shadow:0 25px 80px #0008}.sc-dialog-card h2{margin:0 0 14px}.sc-wizard-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sc-wizard-grid .wide{grid-column:1/-1}.sc-step{display:none}.sc-step.on{display:block}.sc-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.sc-instruments{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.sc-instruments label{padding:8px;border:1px solid #c6cec8;border-radius:7px;background:#fff}.sc-recent{display:grid;gap:7px}.sc-recent-item{display:flex;align-items:center;gap:8px;padding:11px;border:1px solid #ccd2cd;border-radius:8px;background:#fff}.sc-recent-item b{flex:1}.sc-start{position:fixed;inset:0;z-index:10010;overflow:auto;padding:70px 24px;background:radial-gradient(circle at 20% 10%,#dcece2,#b8c8bd 55%,#9aa79f)}.sc-start.hidden{display:none}.sc-start-shell{width:min(1000px,96vw);margin:auto}.sc-start-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:22px}.sc-start-head h1{margin:0;color:#193e2b;font:800 35px Georgia,serif}.sc-start-head p{margin:7px 0 0;color:#53655a}.sc-start-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}.sc-start-card{min-height:150px;padding:22px;border:1px solid #fff9;border-radius:18px;background:#f8fbf8dd;box-shadow:0 10px 30px #20372a26;text-align:left;cursor:pointer}.sc-start-card:hover{transform:translateY(-2px);border-color:#4e936d}.sc-start-card strong{display:block;margin:8px 0;font-size:20px;color:#22573b}.sc-start-icon{font-size:31px}.sc-start-recent{margin-top:20px;padding:18px;border:1px solid #fff8;border-radius:18px;background:#f4f8f5c9}.sc-start-list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.sc-start-item{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #c5d0c8;border-radius:10px;background:#fff;color:#263c2f;text-align:left}.sc-start-item span{flex:1}.sc-start-item small{display:block;color:#77847b}.sc-bottom-panel{position:fixed;z-index:50;left:224px;right:250px;bottom:42px;max-height:250px;overflow:auto;border-top:1px solid #888;background:#eef0ed;box-shadow:0 -8px 25px #0003}.sc-bottom-panel.hidden{display:none}.sc-piano{display:flex;min-width:720px;height:120px;padding:10px}.sc-piano button{position:relative;flex:1;border:1px solid #888;background:#fff}.sc-piano button.black{height:68%;margin:0 -2.2%;z-index:2;background:#202522;color:#fff}.sc-mixer{display:flex;gap:8px;padding:12px;overflow-x:auto}.sc-channel{flex:0 0 135px;padding:9px;border:1px solid #bbc2bc;border-radius:8px;background:#fff}.sc-channel input{width:100%}
  @media(max-width:1050px){.sc-work{grid-template-columns:190px minmax(420px,1fr)}.sc-right{display:none}.sc-bottom-panel{left:190px;right:0}.sc-menubar .sc-menu:nth-of-type(n+7){display:none}}
  @media(max-width:720px){#scoreEditor{overflow:auto}.sc-app{min-width:0;height:auto;min-height:100vh;grid-template-rows:auto auto minmax(0,1fr) 44px}.sc-menubar{overflow-x:auto}.sc-brand{min-width:max-content}.sc-menu>button{padding:0 6px}.sc-toolbar{padding:6px}.sc-work{display:block}.sc-left,.sc-right{display:none}.sc-canvas{padding:8px;min-height:70vh}.sc-paper{padding:20px 8px;min-width:700px}.sc-bottom-panel{left:0;right:0;bottom:44px}.sc-save-state{display:none}.sc-wizard-grid{grid-template-columns:1fr}.sc-wizard-grid .wide{grid-column:auto}.sc-instruments{grid-template-columns:1fr 1fr}.sc-start{padding:35px 12px}.sc-start-head{display:block}.sc-start-actions,.sc-start-list{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  page.innerHTML = `<div class="sc-app">
    <div class="sc-menubar"><b class="sc-brand">和田玉 · 制谱</b>
      ${menu('文件',[['score.home','乐谱选择',''],['score.new','新建乐谱','Ctrl+N'],['score.open','打开最近','Ctrl+O'],['score.save','保存','Ctrl+S'],['score.saveAs','另存为','Ctrl+Shift+S'],['score.import','导入 JSON',''],['score.export','导出 JSON',''],['score.exportSvg','导出 SVG',''],['score.print','打印 / PDF','Ctrl+P']])}
      ${menu('编辑',[['edit.undo','撤销','Ctrl+Z'],['edit.redo','重做','Ctrl+Shift+Z'],['edit.delete','删除选中','Delete'],['edit.copy','复制音符','Ctrl+C'],['edit.paste','粘贴音符','Ctrl+V']])}
      ${menu('视图',[['view.page','页面视图',''],['view.width','适合宽度',''],['panel.palette','音符面板',''],['panel.properties','属性面板',''],['panel.piano','虚拟钢琴','']])}
      ${menu('添加',[['measure.add','添加小节',''],['measure.remove','删除当前小节',''],['part.add','添加乐器',''],['symbol.chord','添加和弦',''],['symbol.function','添加功能谱',''],['symbol.lyric','添加歌词','']])}
      ${menu('音符',[['duration.4','全音符','1'],['duration.2','二分音符','2'],['duration.1','四分音符','3'],['duration.0.5','八分音符','4'],['note.rest','休止符','R'],['note.dot','附点','.']])}
      ${menu('播放',[['play.toggle','播放 / 暂停','Space'],['play.stop','停止','Esc'],['play.metronome','节拍器','M']])}
      ${menu('总谱',[['part.add','添加乐器',''],['part.remove','删除乐器',''],['part.score','显示总谱','']])}
      ${menu('帮助',[['help.shortcuts','快捷键','?'],['help.about','关于制谱','']])}
      <span id="scSaveState" class="sc-save-state">未保存</span>
    </div>
    <div class="sc-toolbar">
      <button class="sc-btn" data-page="menu" title="返回工具箱">← 工具箱</button><button class="sc-btn" data-command="score.home">乐谱库</button>
      <button class="sc-btn" data-command="score.new" title="新建">新建</button><button class="sc-btn" data-command="score.open">打开</button><button class="sc-btn" data-command="score.save">保存</button>
      <span class="sc-divider"></span><button class="sc-btn" data-command="edit.undo">↶</button><button class="sc-btn" data-command="edit.redo">↷</button>
      <button id="scPlay" class="sc-btn primary" data-command="play.toggle">▶ 播放</button><button class="sc-btn" data-command="play.stop">■ 停止</button><button id="scMetro" class="sc-btn" data-command="play.metronome">♩ 节拍器</button>
      <label>速度 <input id="scTempo" class="sc-input" type="number" min="30" max="260" value="120" style="width:70px"></label>
      <label>音量 <input id="scVolume" type="range" min="0" max="100" value="82"></label>
       <label>缩放 <select id="scZoom" class="sc-select"><option>60</option><option>80</option><option selected>100</option><option>125</option><option>150</option></select>%</label><span id="scHoverStatus" style="min-width:150px;color:#317151">移动鼠标到五线谱预览音符</span>
    </div>
    <div class="sc-work">
      <aside id="scLeft" class="sc-left"><div class="sc-panel-title">符号与输入</div><div class="sc-palette">
        <details open><summary>音符与休止符</summary><div id="scDurations" class="sc-palette-grid">${[['𝅝',4],['𝅗𝅥',2],['♩',1],['♪',.5],['𝅘𝅥𝅯',.25],['𝄽','rest']].map(([x,v])=>`<button data-duration="${v}" title="${v}">${x}</button>`).join('')}</div></details>
        <details open><summary>临时记号</summary><div class="sc-palette-grid"><button data-accidental="sharp">♯</button><button data-accidental="flat">♭</button><button data-accidental="natural">♮</button><button data-command="note.dot">·</button></div></details>
        <details><summary>和弦与功能谱</summary><div class="sc-palette-grid"><button data-command="symbol.chord">C7</button><button data-command="symbol.function">V7</button><button data-command="symbol.lyric">词</button><button data-command="measure.add">＋小节</button><button data-command="measure.remove">－小节</button></div></details>
        <details open><summary>分谱与乐器</summary><div id="scPartList" class="sc-part-list"></div><button class="sc-btn" style="margin:9px" data-command="part.add">＋ 添加乐器</button></details>
      </div></aside>
      <main id="scCanvas" class="sc-canvas"><article id="scPaper" class="sc-paper"><i id="scPlayCursor" class="sc-play-cursor"></i><header class="sc-title"><h1 id="scTitle"></h1><p id="scSubtitle"></p><small id="scComposer"></small></header><div id="scScoreSheets"></div></article></main>
      <aside id="scRight" class="sc-right"><div class="sc-panel-title">属性</div><div id="scProperties" class="sc-properties"></div></aside>
    </div>
    <div id="scTabs" class="sc-tabs"><button class="on" data-part-view="score">总谱</button><i class="sc-spacer"></i><button data-bottom="timeline">时间轴</button><button data-bottom="mixer">混音器</button><button data-bottom="piano">虚拟钢琴</button><button data-bottom="fretboard">吉他指板</button></div>
    <div id="scBottom" class="sc-bottom-panel hidden"></div>
    <input id="scImportFile" type="file" accept=".json,application/json" hidden>
  </div>
  <div id="scStart" class="sc-start"><div class="sc-start-shell"><div class="sc-start-head"><div><h1>选择一份乐谱</h1><p>新建乐谱、继续最近作品，或者导入已有工程。</p></div><button class="sc-btn" data-page="menu">← 返回工具箱</button></div><div class="sc-start-actions"><button class="sc-start-card" data-score-start="new"><span class="sc-start-icon">𝄞</span><strong>新建乐谱</strong><span>选择谱式、乐器、调号、拍号和小节数。</span></button><button class="sc-start-card" data-score-start="continue"><span class="sc-start-icon">↗</span><strong>继续上次乐谱</strong><span>打开本机自动保存的上一份作品。</span></button><button class="sc-start-card" data-score-start="import"><span class="sc-start-icon">⇧</span><strong>导入乐谱</strong><span>打开和田玉乐谱 JSON 工程文件。</span></button></div><section class="sc-start-recent"><h2>最近乐谱</h2><div id="scStartList" class="sc-start-list"></div></section></div></div>
  <div id="scWizard" class="sc-dialog hidden"></div><div id="scRecentDialog" class="sc-dialog hidden"></div>`;

  function menu(label, items) {
    return `<div class="sc-menu"><button>${label}</button><div class="sc-menu-list">${items.map(([id,text,key])=>`<button data-command="${id}"><span>${text}</span><small>${key}</small></button>`).join('')}</div></div>`;
  }
  const $ = id => page.querySelector('#' + id);
  let score = createScore(), selectedEventId = '', activePartId = '', duration = 1, restMode = false, accidental = '';
  let inputMeasureIndex = 0, inputBeat = 0;
  let clipboardEvent = null, history = [], future = [], dirty = false, bottomPanel = '';
  const autosave = NS.storage.autosave(() => saveScore(true), 900);
  const playback = new NS.PlaybackEngine(updatePlayCursor, state => {
    $('scPlay').textContent = state === 'playing' ? 'Ⅱ 暂停' : '▶ 播放';
    $('scPlay').classList.toggle('on', state === 'playing');
  });

  function executeChange(label, mutate, revert) {
    mutate(); history.push({ label, undo: revert, redo: mutate }); if (history.length > 120) history.shift();
    future = []; markDirty(); render();
  }
  function markDirty() { dirty = true; $('scSaveState').textContent = '存在未保存修改'; autosave.schedule(); }
  async function saveScore(auto = false) {
    try { $('scSaveState').textContent = auto ? '正在自动保存…' : '正在保存…'; await NS.storage.put(score); dirty = false; $('scSaveState').textContent = '已保存 · ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
    catch (error) { $('scSaveState').textContent = '保存失败：' + error.message; }
  }
  function currentPart() { return score.parts.find(part => part.id === activePartId) || score.parts[0]; }
  function selected() { return findEvent(score, selectedEventId); }
  function render() {
    score.metadata.updatedAt = Date.now(); activePartId ||= score.parts[0]?.id || '';
    $('scTitle').textContent = score.metadata.title; $('scSubtitle').textContent = score.metadata.subtitle;
    $('scComposer').textContent = [score.metadata.composer && `作曲：${score.metadata.composer}`, score.metadata.lyricist && `作词：${score.metadata.lyricist}`].filter(Boolean).join('　');
    $('scTempo').value = score.settings.tempo; $('scVolume').value = score.settings.masterVolume * 100; $('scZoom').value = score.settings.zoom;
    $('scCanvas').classList.toggle('continuous', score.settings.viewMode === 'continuous');
    $('scPaper').style.transform = `scale(${score.settings.zoom/100})`; $('scPaper').style.marginBottom = `${Math.max(0, score.settings.zoom-100)*8}px`;
    const parts = score.selectedPartId ? score.parts.filter(part => part.id === score.selectedPartId) : score.parts;
    $('scScoreSheets').innerHTML = '';
    const width = 980;
    parts.forEach(part => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.classList.add('sc-score-svg'); svg.dataset.partId = part.id;
      NS.renderers.renderStaff(svg, score, part, {
        selectedEventId, width, snapStep:.125, accidental,
        onSelect: id => { selectedEventId=id; activePartId=part.id; const found=findEvent(score,id);if(found){inputMeasureIndex=score.measures.indexOf(found.measure);inputBeat=found.event.start+found.event.duration}render(); },
        onMeasureClick: (measureId,start,midi) => addAt(measureId,start,midi,part.id),
        onMeasureHover: (measureId,start,midi) => {const index=score.measures.findIndex(item=>item.id===measureId);$('scHoverStatus').textContent=`第 ${index+1} 小节 · ${start.toFixed(3).replace(/0+$/,'').replace(/\.$/,'')} 拍 · ${midiName(midi)}`},
        onMeasureLeave: () => {$('scHoverStatus').textContent='移动鼠标到五线谱预览音符'}
      });
      $('scScoreSheets').appendChild(svg);
    });
    renderParts(); renderTabs(); renderProperties(); renderBottom();
  }
  function renderParts() {
    $('scPartList').innerHTML = score.parts.map((part,index)=>`<div class="sc-part ${part.id===activePartId?'active':''}" data-part="${part.id}"><i style="background:hsl(${index*67%360} 48% 45%)"></i><span><b>${esc(part.name)}</b><small>${esc(part.shortName)}</small></span><button class="sc-mini ${part.mute?'on':''}" data-part-action="mute">M</button><button class="sc-mini ${part.solo?'on':''}" data-part-action="solo">S</button></div>`).join('');
  }
  function renderTabs() {
    $('scTabs').querySelectorAll('[data-part-view]').forEach(node => node.remove());
    const before = $('scTabs').querySelector('.sc-spacer');
    const items = [{id:'score',name:'总谱'}, ...score.parts.map(part=>({id:part.id,name:part.name+'分谱'}))];
    items.forEach(item => { const button=document.createElement('button'); button.dataset.partView=item.id; button.textContent=item.name; button.classList.toggle('on', item.id===(score.selectedPartId||'score')); $('scTabs').insertBefore(button,before); });
  }
  function renderProperties() {
    const found = selected(), part = currentPart();
    if (found) {
      const event = found.event;
      $('scProperties').innerHTML = `<h3>${event.type==='rest'?'休止符':'音符 '+midiName(event.midi)}</h3>
        ${event.type==='note'?`<label class="sc-field">音高（MIDI）<input id="scPropMidi" type="number" min="0" max="127" value="${event.midi}"></label>`:''}
        <label class="sc-field">时值（拍）<select id="scPropDuration">${[4,2,1,.5,.25,.125].map(value=>`<option ${value===event.duration?'selected':''}>${value}</option>`).join('')}</select></label>
        <div class="sc-inline"><label class="sc-field">声部<select id="scPropVoice">${[1,2,3,4].map((v,i)=>`<option value="${i}" ${i===event.voice?'selected':''}>${v}</option>`).join('')}</select></label><label class="sc-field">力度<input id="scPropVelocity" type="number" min="1" max="127" value="${event.velocity}"></label></div>
        <label class="sc-field">歌词<input id="scPropLyric" value="${esc(event.lyric)}" placeholder="输入歌词音节"></label>
        ${part.showTab&&event.type==='note'?`<div class="sc-inline"><label class="sc-field">弦<input id="scPropString" type="number" min="1" max="${part.tuning.length}" value="${event.tab?.string||1}"></label><label class="sc-field">品<input id="scPropFret" type="number" min="0" max="24" value="${event.tab?.fret||0}"></label></div>`:''}
        <button class="sc-btn danger" data-command="edit.delete">删除音符</button>`;
      ['Midi','Duration','Voice','Velocity','Lyric','String','Fret'].forEach(name => {
        const input=$('scProp'+name); if(input) input.onchange=()=>updateSelectedFromProperties();
      });
    } else {
      $('scProperties').innerHTML = `<h3>${esc(part?.name||'乐谱')}属性</h3>
        <label class="sc-field">曲名<input id="scMetaTitle" value="${esc(score.metadata.title)}"></label>
        <label class="sc-field">作曲<input id="scMetaComposer" value="${esc(score.metadata.composer)}"></label>
        <label class="sc-field">乐器名称<input id="scPartName" value="${esc(part?.name||'')}"></label>
        <label class="sc-field">谱式<select id="scPartNotation"><option value="staff">五线谱</option><option value="numbered">五线谱＋简谱</option><option value="tab">五线谱＋六线谱</option><option value="all">三谱联动</option></select></label>
        <label class="sc-field">轨道音量<input id="scPartVolume" type="range" min="0" max="100" value="${(part?.volume||.8)*100}"></label>
        <label class="sc-field">声像<input id="scPartPan" type="range" min="-100" max="100" value="${(part?.pan||0)*100}"></label>`;
      $('scPartNotation').value = part.showTab&&part.showNumbered?'all':part.showTab?'tab':part.showNumbered?'numbered':'staff';
      $('scMetaTitle').onchange=e=>{score.metadata.title=e.target.value||'未命名乐谱';markDirty();render()};
      $('scMetaComposer').onchange=e=>{score.metadata.composer=e.target.value;markDirty();render()};
      $('scPartName').onchange=e=>{part.name=e.target.value||part.name;markDirty();render()};
      $('scPartNotation').onchange=e=>{part.showNumbered=['numbered','all'].includes(e.target.value);part.showTab=['tab','all'].includes(e.target.value);markDirty();render()};
      $('scPartVolume').oninput=e=>{part.volume=+e.target.value/100;markDirty()}; $('scPartPan').oninput=e=>{part.pan=+e.target.value/100;markDirty()};
    }
  }
  function updateSelectedFromProperties() {
    const found=selected(); if(!found)return; const before=clone(found.event), part=currentPart();
    const after={...before};
    if($('scPropMidi'))after.midi=Math.max(0,Math.min(127,+$('scPropMidi').value||60));
    after.noteName=midiName(after.midi); after.duration=+$('scPropDuration').value; after.voice=+$('scPropVoice').value;
    after.velocity=Math.max(1,Math.min(127,+$('scPropVelocity').value||88)); after.lyric=$('scPropLyric').value;
    if($('scPropString')){after.tab={string:+$('scPropString').value,fret:+$('scPropFret').value};after.midi=part.tuning[after.tab.string-1]+after.tab.fret;after.noteName=midiName(after.midi)}
    Object.assign(found.event,after); history.push({label:'修改音符',undo:()=>Object.assign(found.event,before),redo:()=>Object.assign(found.event,after)});future=[];markDirty();render();
  }
  function addAt(measureId,start,midi,partId=activePartId) {
    const measure=score.measures.find(item=>item.id===measureId), snap=Math.round(start/.125)*.125;
    if(!measure)return; const event=makeEvent({partId,midi,start:snap,duration,rest:restMode,voice:0,accidental});
    selectedEventId=event.id;
    const list=measure.voices[0]; executeChange(event.type==='rest'?'添加休止符':'添加音符',()=>{if(!list.some(item=>item.id===event.id))list.push(event);list.sort((a,b)=>a.start-b.start)},()=>{const i=list.findIndex(item=>item.id===event.id);if(i>=0)list.splice(i,1)});
    moveInputCursor(measure, snap + duration);
  }
  function moveInputCursor(measure, beat) {
    inputMeasureIndex=Math.max(0,score.measures.indexOf(measure));inputBeat=Math.max(0,beat);
    while(inputMeasureIndex<score.measures.length-1){const current=score.measures[inputMeasureIndex],beats=current.timeSignature?.numerator||4;if(inputBeat<beats)break;inputBeat-=beats;inputMeasureIndex++}
    const finalMeasure=score.measures[inputMeasureIndex],finalBeats=finalMeasure?.timeSignature?.numerator||4;inputBeat=Math.min(inputBeat,Math.max(0,finalBeats-.125));
  }
  function addAtCursor(midi){const measure=score.measures[inputMeasureIndex]||score.measures[0];if(measure)addAt(measure.id,inputBeat,midi,activePartId)}
  function addPart() {
    const names=Object.entries(INSTRUMENTS).map(([id,item])=>`${id}:${item.name}`).join('\\n');
    const input=prompt('输入乐器代码：\\n'+names,'guitar'); if(!input||!INSTRUMENTS[input])return;
    const part=makePart(input,INSTRUMENTS[input].tablature?'staff-tab':'staff');
    executeChange('添加乐器',()=>{if(!score.parts.some(item=>item.id===part.id))score.parts.push(part);activePartId=part.id},()=>{score.parts=score.parts.filter(item=>item.id!==part.id);activePartId=score.parts[0]?.id||''});
  }
  function removePart() {
    if (score.parts.length < 2) { alert('总谱至少需要保留一个乐器。'); return; }
    const part = currentPart();
    if (!part || !confirm(`确定删除“${part.name}”及其全部音符吗？`)) return;
    const before = clone(score);
    const after = clone(score);
    after.parts = after.parts.filter(item => item.id !== part.id);
    after.measures.forEach(measure => {
      measure.voices.forEach((voice, index) => { measure.voices[index] = voice.filter(event => event.partId !== part.id); });
      measure.chordSymbols = measure.chordSymbols.filter(item => item.partId !== part.id);
      measure.harmonyFunctions = measure.harmonyFunctions.filter(item => item.partId !== part.id);
    });
    after.selectedPartId = null;
    executeChange('删除乐器', () => { score = clone(after); activePartId = score.parts[0].id; selectedEventId = ''; }, () => { score = clone(before); activePartId = part.id; });
  }
  function addMeasure() {
    const measure=makeMeasure(score.measures.length,score.settings.meter);
    executeChange('添加小节',()=>{if(!score.measures.some(item=>item.id===measure.id))score.measures.push(measure)},()=>{score.measures=score.measures.filter(item=>item.id!==measure.id)});
  }
  function removeMeasure() {
    if(score.measures.length<2){alert('乐谱至少需要保留一个小节。');return}
    const found=selected(),index=found?score.measures.indexOf(found.measure):Math.min(inputMeasureIndex,score.measures.length-1),measure=score.measures[index];
    if(!confirm(`确定删除第 ${index+1} 小节及其中全部内容吗？`))return;
    executeChange('删除小节',()=>{score.measures=score.measures.filter(item=>item.id!==measure.id);score.measures.forEach((item,i)=>item.index=i);selectedEventId='';inputMeasureIndex=Math.min(index,score.measures.length-1);inputBeat=0},()=>{score.measures.splice(index,0,measure);score.measures.forEach((item,i)=>item.index=i);inputMeasureIndex=index});
  }
  function addBoundSymbol(type) {
    const found=selected(), measure=found?.measure||score.measures[0], start=found?.event.start||0;
    const label=type==='chord'?'和弦符号':type==='function'?'功能谱':'歌词';
    const value=prompt(`输入${label}`,type==='chord'?'Cmaj7':type==='function'?'I':'啊');
    if(value===null)return;
    if(type==='lyric'&&found){const before=found.event.lyric;executeChange('添加歌词',()=>found.event.lyric=value,()=>found.event.lyric=before);return}
    const list=type==='chord'?measure.chordSymbols:measure.harmonyFunctions,item={id:uid(type),partId:activePartId,start,text:value};
    executeChange('添加'+label,()=>list.push(item),()=>{const i=list.findIndex(x=>x.id===item.id);if(i>=0)list.splice(i,1)});
  }
  function undo(){const action=history.pop();if(!action)return;action.undo();future.push(action);markDirty();render()}
  function redo(){const action=future.pop();if(!action)return;action.redo();history.push(action);markDirty();render()}
  function deleteSelected(){const found=selected();if(!found)return;const event=clone(found.event),list=found.measure.voices[found.voiceIndex],index=found.eventIndex;executeChange('删除音符',()=>{const i=list.findIndex(item=>item.id===event.id);if(i>=0)list.splice(i,1);selectedEventId=''},()=>list.splice(index,0,event))}
  function toggleDot() {
    const found = selected(); if (!found) return;
    const before = { dots: found.event.dots || 0, duration: found.event.duration };
    const nextDots = (before.dots + 1) % 3;
    const baseDuration = before.duration / (before.dots === 1 ? 1.5 : before.dots === 2 ? 1.75 : 1);
    const after = { dots: nextDots, duration: baseDuration * (nextDots === 1 ? 1.5 : nextDots === 2 ? 1.75 : 1) };
    executeChange('附点', () => Object.assign(found.event, after), () => Object.assign(found.event, before));
  }
  function exportJson(){download(new Blob([JSON.stringify(score,null,2)],{type:'application/json'}),`${safeName(score.metadata.title)}.hetian-score.json`)}
  function exportSvg(){const svgs=[...page.querySelectorAll('.sc-score-svg')];if(!svgs.length)return;download(new Blob([NS.renderers.scoreToSvgText(svgs[0])],{type:'image/svg+xml'}),`${safeName(score.metadata.title)}.svg`)}
  function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function safeName(name){return String(name||'乐谱').replace(/[\\/:*?"<>|]/g,'_')}
  function resetInputCursor(){inputMeasureIndex=0;inputBeat=0;selectedEventId=''}
  function showEditor(){ $('scStart').classList.add('hidden'); }
  function renderScoreHome(){
    const recent=NS.storage.listRecent();$('scStartList').innerHTML=recent.length?recent.slice(0,8).map(item=>`<button class="sc-start-item" data-start-id="${item.id}"><span><b>${esc(item.title)}</b><small>${new Date(item.updatedAt).toLocaleString()}</small></span><i>打开 ›</i></button>`).join(''):'<div style="padding:15px;color:#718077">还没有保存过乐谱，可以先新建一份。</div>';
  }
  function showScoreHome(){playback.stop(false);renderScoreHome();$('scStart').classList.remove('hidden')}
  async function openStoredScore(id){
    const loaded=await NS.storage.get(id);if(!loaded){alert('没有找到这份乐谱，可能已被删除。');renderScoreHome();return}
    score=migrateScore(loaded);activePartId=score.parts[0]?.id||'';resetInputCursor();history=[];future=[];showEditor();render();
  }
  async function importJson(file){const raw=JSON.parse(await file.text());playback.stop();score=migrateScore(raw);activePartId=score.parts[0].id;resetInputCursor();history=[];future=[];await saveScore();showEditor();render()}
  function showWizard() {
    const dialog=$('scWizard');let step=1;
    dialog.innerHTML=`<div class="sc-dialog-card"><h2>新建乐谱向导</h2>
      <section class="sc-step on" data-step="1"><div class="sc-wizard-grid"><label>曲名<input id="wizTitle" class="sc-input" value="我的乐谱"></label><label>副标题<input id="wizSubtitle" class="sc-input"></label><label>作曲<input id="wizComposer" class="sc-input"></label><label>作词<input id="wizLyricist" class="sc-input"></label><label>编曲<input id="wizArranger" class="sc-input"></label><label>演唱<input id="wizSinger" class="sc-input"></label><label class="wide">备注<input id="wizNotes" class="sc-input"></label></div></section>
      <section class="sc-step" data-step="2"><h3>乐谱类型</h3><div class="sc-instruments">${[['staff','五线谱'],['numbered','五线谱＋简谱'],['tab','五线谱＋六线谱'],['all','五线谱＋简谱＋六线谱']].map(([v,t])=>`<label><input type="radio" name="wizNotation" value="${v}" ${v==='staff'?'checked':''}> ${t}</label>`).join('')}</div></section>
      <section class="sc-step" data-step="3"><h3>乐器或声部</h3><div class="sc-instruments">${Object.entries(INSTRUMENTS).map(([id,item])=>`<label><input type="checkbox" name="wizInstrument" value="${id}" ${id==='piano'?'checked':''}> ${item.name}</label>`).join('')}</div></section>
      <section class="sc-step" data-step="4"><div class="sc-wizard-grid"><label>调号<select id="wizKey" class="sc-select"><option>C</option><option>G</option><option>D</option><option>F</option><option>B♭</option><option>E♭</option></select></label><label>拍号<select id="wizMeter" class="sc-select">${['2/4','3/4','4/4','3/8','6/8','9/8','12/8'].map(v=>`<option ${v==='4/4'?'selected':''}>${v}</option>`).join('')}</select></label><label>速度<input id="wizTempo" class="sc-input" type="number" value="120"></label><label>小节数<input id="wizMeasures" class="sc-input" type="number" value="8"></label><label>页面<select id="wizPage" class="sc-select"><option>A4</option><option>A3</option><option>Letter</option></select></label><label>方向<select id="wizOrientation" class="sc-select"><option value="portrait">纵向</option><option value="landscape">横向</option></select></label></div></section>
      <div class="sc-dialog-actions"><button id="wizCancel" class="sc-btn">取消</button><button id="wizPrev" class="sc-btn" disabled>上一步</button><button id="wizNext" class="sc-btn primary">下一步</button></div></div>`;
    dialog.classList.remove('hidden');const refresh=()=>{dialog.querySelectorAll('.sc-step').forEach(node=>node.classList.toggle('on',+node.dataset.step===step));dialog.querySelector('#wizPrev').disabled=step===1;dialog.querySelector('#wizNext').textContent=step===4?'创建乐谱':'下一步'};
    dialog.querySelector('#wizCancel').onclick=()=>dialog.classList.add('hidden');dialog.querySelector('#wizPrev').onclick=()=>{step--;refresh()};dialog.querySelector('#wizNext').onclick=()=>{if(step<4){step++;refresh();return}const instruments=[...dialog.querySelectorAll('[name=wizInstrument]:checked')].map(node=>node.value);const notation=dialog.querySelector('[name=wizNotation]:checked').value;
      score=createScore({title:dialog.querySelector('#wizTitle').value,subtitle:dialog.querySelector('#wizSubtitle').value,composer:dialog.querySelector('#wizComposer').value,lyricist:dialog.querySelector('#wizLyricist').value,arranger:dialog.querySelector('#wizArranger').value,singer:dialog.querySelector('#wizSinger').value,notes:dialog.querySelector('#wizNotes').value,notation,instruments,key:dialog.querySelector('#wizKey').value,meter:dialog.querySelector('#wizMeter').value,tempo:dialog.querySelector('#wizTempo').value,measures:dialog.querySelector('#wizMeasures').value,pageSize:dialog.querySelector('#wizPage').value,orientation:dialog.querySelector('#wizOrientation').value});score.parts.forEach(part=>{part.showNumbered=['numbered','all'].includes(notation);part.showTab=['tab','all'].includes(notation)});activePartId=score.parts[0].id;resetInputCursor();history=[];future=[];dialog.classList.add('hidden');showEditor();markDirty();render()};
  }
  async function showRecent() {
    const dialog=$('scRecentDialog'),recent=NS.storage.listRecent();dialog.innerHTML=`<div class="sc-dialog-card"><h2>最近乐谱</h2><div class="sc-recent">${recent.length?recent.map(item=>`<div class="sc-recent-item" data-id="${item.id}"><b>${esc(item.title)}</b><small>${new Date(item.updatedAt).toLocaleString()}</small><button class="sc-btn" data-open>打开</button><button class="sc-btn danger" data-remove>删除</button></div>`).join(''):'暂无已保存乐谱'}</div><div class="sc-dialog-actions"><button class="sc-btn" data-close>关闭</button></div></div>`;dialog.classList.remove('hidden');dialog.onclick=async event=>{if(event.target.matches('[data-close]'))dialog.classList.add('hidden');const row=event.target.closest('[data-id]');if(!row)return;if(event.target.matches('[data-open]')){dialog.classList.add('hidden');await openStoredScore(row.dataset.id)}if(event.target.matches('[data-remove]')){if(confirm('确定删除这个乐谱吗？')){await NS.storage.remove(row.dataset.id);showRecent()}}};
  }
  const commands = {
    'score.home':showScoreHome,'score.new':showWizard,'score.open':showRecent,'score.save':()=>saveScore(),'score.saveAs':()=>{const title=prompt('另存为曲名',score.metadata.title+' 副本');if(title){score=clone(score);score.id=uid('score');score.metadata.title=title;saveScore();render()}},'score.import':()=>$('scImportFile').click(),'score.export':exportJson,'score.exportSvg':exportSvg,'score.print':()=>window.print(),
    'edit.undo':undo,'edit.redo':redo,'edit.delete':deleteSelected,'edit.copy':()=>{const found=selected();clipboardEvent=found?clone(found.event):null},'edit.paste':()=>{if(!clipboardEvent)return;const event={...clone(clipboardEvent),id:uid('note'),start:clipboardEvent.start+clipboardEvent.duration,partId:activePartId};const list=selected()?.measure.voices[0]||score.measures[0].voices[0];executeChange('粘贴音符',()=>list.push(event),()=>{const i=list.findIndex(x=>x.id===event.id);if(i>=0)list.splice(i,1)})},
    'measure.add':addMeasure,'measure.remove':removeMeasure,'part.add':addPart,'part.remove':removePart,'part.score':()=>{score.selectedPartId=null;render()},'symbol.chord':()=>addBoundSymbol('chord'),'symbol.function':()=>addBoundSymbol('function'),'symbol.lyric':()=>addBoundSymbol('lyric'),
    'play.toggle':()=>playback.playing?playback.pause():playback.play(score),'play.stop':()=>playback.stop(true),'play.metronome':()=>{score.settings.metronome=!score.settings.metronome;$('scMetro').classList.toggle('on',score.settings.metronome);markDirty()},
    'note.rest':()=>{restMode=!restMode;renderDurationButtons()},'note.dot':toggleDot,
    'panel.piano':()=>toggleBottom('piano'),'panel.palette':()=>{$('scLeft').hidden=!$('scLeft').hidden},'panel.properties':()=>{$('scRight').hidden=!$('scRight').hidden},'view.page':()=>{score.settings.viewMode=score.settings.viewMode==='continuous'?'page':'continuous';markDirty();render()},'view.width':()=>{score.settings.zoom=Math.max(60,Math.min(125,Math.floor(($('scCanvas').clientWidth-30)/1060*100)));render()},
    'help.shortcuts':()=>alert('A–G 输入音名｜1–7 切换时值｜R 休止符｜Delete 删除｜Ctrl+Z 撤销｜Ctrl+Shift+Z 重做｜Space 播放/暂停'),'help.about':()=>alert('和田玉音乐工具箱 · 制谱核心版\\n统一数据驱动五线谱、简谱与六线谱。')
  };
  function executeCommand(id){if(id.startsWith('duration.')){duration=+id.slice(9);restMode=false;renderDurationButtons();return}commands[id]?.()}
  function renderDurationButtons(){$('scDurations').querySelectorAll('button').forEach(button=>button.classList.toggle('on',String(button.dataset.duration)===String(restMode?'rest':duration)))}
  function toggleBottom(type){bottomPanel=bottomPanel===type?'':type;$('scBottom').classList.toggle('hidden',!bottomPanel);renderBottom()}
  function renderBottom() {
    if(!bottomPanel)return;const bottom=$('scBottom');
    if(bottomPanel==='piano'){const white=[60,62,64,65,67,69,71,72,74,76,77,79,81,83,84];bottom.innerHTML=`<div class="sc-piano">${white.map(m=>`<button data-midi="${m}">${midiName(m)}</button>`).join('')}</div>`;bottom.querySelectorAll('[data-midi]').forEach(button=>button.onclick=()=>addAtCursor(+button.dataset.midi))}
    else if(bottomPanel==='mixer')bottom.innerHTML=`<div class="sc-mixer">${score.parts.map(part=>`<div class="sc-channel" data-part="${part.id}"><b>${esc(part.name)}</b><label class="sc-field">音量<input data-mix="volume" type="range" min="0" max="100" value="${part.volume*100}"></label><label class="sc-field">声像<input data-mix="pan" type="range" min="-100" max="100" value="${part.pan*100}"></label><button class="sc-mini ${part.mute?'on':''}" data-mix="mute">M</button> <button class="sc-mini ${part.solo?'on':''}" data-mix="solo">S</button></div>`).join('')}</div>`;
    else bottom.innerHTML=`<div style="padding:18px">当前面板：${bottomPanel}　小节 ${score.measures.length}　声部 ${score.parts.length}</div>`;
  }
  function updatePlayCursor(beat){const cursor=$('scPlayCursor'),svg=page.querySelector('.sc-score-svg');if(!playback.playing||!svg){cursor.style.display='none';return}const beats=+(score.settings.meter.split('/')[0])||4,measureIndex=Math.max(0,Math.min(score.measures.length-1,Math.floor(beat/beats))),local=beat-measureIndex*beats,width=980,measureW=Math.max(150,Math.min(230,(width-105)/Math.max(1,score.settings.measuresPerSystem||4))),perSystem=Math.max(1,Math.floor((width-105)/measureW)),row=Math.floor(measureIndex/perSystem),column=measureIndex%perSystem,part=score.selectedPartId?score.parts.find(item=>item.id===score.selectedPartId):score.parts[0],systemH=part?.showTab||part?.showNumbered?185:128,x=92+column*measureW+38+local*(measureW-46)/beats,y=42+row*systemH,svgRect=svg.getBoundingClientRect(),paperRect=$('scPaper').getBoundingClientRect(),viewHeight=+svg.getAttribute('height')||1;cursor.style.display='block';cursor.style.left=svgRect.left-paperRect.left+x/width*svgRect.width+'px';cursor.style.top=svgRect.top-paperRect.top+y/viewHeight*svgRect.height+'px';cursor.style.height=36/viewHeight*svgRect.height+'px';$('scSaveState').dataset.playBeat=beat.toFixed(2)}

  page.addEventListener('click',async event=>{const startAction=event.target.closest('[data-score-start]'),recent=event.target.closest('[data-start-id]');if(!startAction&&!recent)return;event.stopImmediatePropagation();if(recent){await openStoredScore(recent.dataset.startId);return}if(startAction.dataset.scoreStart==='new'){showWizard();return}if(startAction.dataset.scoreStart==='import'){$('scImportFile').click();return}const last=NS.storage.lastId();if(last)await openStoredScore(last);else showWizard()});
  page.addEventListener('click',event=>{const menuButton=event.target.closest('.sc-menu>button');if(menuButton){const owner=menuButton.parentElement;page.querySelectorAll('.sc-menu').forEach(menu=>menu.classList.toggle('open',menu===owner&&!menu.classList.contains('open')));return}const command=event.target.closest('[data-command]');if(command){executeCommand(command.dataset.command);page.querySelectorAll('.sc-menu').forEach(menu=>menu.classList.remove('open'));return}const durationButton=event.target.closest('[data-duration]');if(durationButton){if(durationButton.dataset.duration==='rest')restMode=true;else{duration=+durationButton.dataset.duration;restMode=false}renderDurationButtons();return}const accidentalButton=event.target.closest('[data-accidental]');if(accidentalButton){accidental=accidentalButton.dataset.accidental;page.querySelectorAll('[data-accidental]').forEach(button=>button.classList.toggle('on',button===accidentalButton));const found=selected();if(found){const before=found.event.accidental||'';executeChange('临时记号',()=>found.event.accidental=accidental,()=>found.event.accidental=before)}else render();return}const partNode=event.target.closest('[data-part]');if(partNode){activePartId=partNode.dataset.part;const part=currentPart(),action=event.target.dataset.partAction||event.target.dataset.mix;if(action==='mute')part.mute=!part.mute;if(action==='solo')part.solo=!part.solo;if(action){markDirty();render()}return}const partView=event.target.closest('[data-part-view]');if(partView){score.selectedPartId=partView.dataset.partView==='score'?null:partView.dataset.partView;activePartId=score.selectedPartId||activePartId;render();return}const bottom=event.target.closest('[data-bottom]');if(bottom)toggleBottom(bottom.dataset.bottom)});
  page.addEventListener('input',event=>{const channel=event.target.closest('.sc-channel');if(!channel)return;const part=score.parts.find(item=>item.id===channel.dataset.part);if(!part)return;if(event.target.dataset.mix==='volume')part.volume=+event.target.value/100;if(event.target.dataset.mix==='pan')part.pan=+event.target.value/100;markDirty()});
  document.addEventListener('click',event=>{if(!page.contains(event.target))page.querySelectorAll('.sc-menu').forEach(menu=>menu.classList.remove('open'))});
  $('scImportFile').onchange=event=>{if(event.target.files[0])importJson(event.target.files[0]);event.target.value=''};
  $('scTempo').onchange=event=>{score.settings.tempo=Math.max(30,Math.min(260,+event.target.value||120));markDirty()};
  $('scVolume').oninput=event=>{score.settings.masterVolume=+event.target.value/100;markDirty()};
  $('scZoom').onchange=event=>{score.settings.zoom=+event.target.value;render()};
  document.addEventListener('keydown',event=>{
    if(page.classList.contains('hidden')||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
    const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
    if(mod&&key==='s'){event.preventDefault();event.shiftKey?commands['score.saveAs']():saveScore();return}
    if(mod&&key==='n'){event.preventDefault();showWizard();return}if(mod&&key==='o'){event.preventDefault();showRecent();return}
    if(mod&&key==='z'){event.preventDefault();event.shiftKey?redo():undo();return}if(mod&&key==='c'){event.preventDefault();commands['edit.copy']();return}if(mod&&key==='v'){event.preventDefault();commands['edit.paste']();return}
    if(event.code==='Space'){event.preventDefault();commands['play.toggle']();return}if(event.key==='Delete'){deleteSelected();return}
    if(key==='r'){restMode=!restMode;renderDurationButtons();return}if('1234567'.includes(key)){duration=[4,2,1,.5,.25,.125,.0625][+key-1];restMode=false;renderDurationButtons();return}
    if('abcdefg'.includes(key)){const pc={c:0,d:2,e:4,f:5,g:7,a:9,b:11}[key],midi=60+pc;addAtCursor(midi)}
  });
  window.addEventListener('pagehide',()=>{autosave.flush();playback.stop(false)});
  window.HetianCore?.audio?.registerStopper('scoreEditor', () => playback.stop(false));
  window.HetianCore?.router?.register('scoreEditor', { leave: () => { autosave.flush(); playback.stop(false); } });
  (async()=>{const last=NS.storage.lastId();if(last){try{const loaded=await NS.storage.get(last);if(loaded)score=migrateScore(loaded)}catch(_){}}activePartId=score.parts[0]?.id||'';resetInputCursor();renderDurationButtons();render();renderScoreHome()})();
})();
