(() => {
  'use strict';
  const nav = document.querySelector('nav'), logout = document.getElementById('logout');
  const tab = document.createElement('button');
  tab.id = 'teacherWorkbenchTab'; tab.dataset.tab = 'questions'; tab.textContent = '教师工作台';
  nav.insertBefore(tab, logout);

  const TYPES = {
    single_note: { label:'单音听辨', icon:'♪', group:'听觉类', subject:'dictation', category:'single', prompt:'请听音频，选择与声音一致的音符。', answer:'C4' },
    interval: { label:'音程听辨', icon:'♫', group:'听觉类', subject:'dictation', category:'interval', prompt:'请听下面两个音，判断它们构成的音程。', answer:'小三度' },
    chord: { label:'和弦听辨', icon:'♬', group:'听觉类', subject:'dictation', category:'chord', prompt:'请听和弦，选择正确的和弦性质。', answer:'大三和弦' },
    rhythm: { label:'节奏听辨', icon:'𝄽', group:'听觉类', subject:'dictation', category:'rhythm', prompt:'请听节奏片段，选择与声音一致的谱例。', answer:'谱例 A' },
    melody: { label:'旋律听写', icon:'𝄞', group:'听觉类', subject:'dictation', category:'melody', prompt:'听下面旋律，将旋律记录在五线谱上。', answer:'教师人工评分' },
    sight_singing: { label:'视唱', icon:'◉', group:'读谱 / 演唱类', subject:'sight_singing', category:'melody', prompt:'请根据下列五线谱进行视唱。', answer:'教师人工评分' },
    theory_choice: { label:'乐理选择', icon:'A', group:'乐理类', subject:'theory', category:'single', prompt:'请选择正确答案。', answer:'' },
    guitar: { label:'吉他乐理', icon:'⌁', group:'乐器类', subject:'theory', category:'single', prompt:'请选择正确答案。', answer:'' },
  };
  const STATUS = { draft:'草稿', submitted:'待审', in_review:'审题中', changes_requested:'需修改', approved:'已通过', published:'已发布', archived:'已归档' };
  const INTERVALS = [
    ['小二度',1],['大二度',2],['小三度',3],['大三度',4],['纯四度',5],['增四度',6],['纯五度',7],['小六度',8],['大六度',9],['小七度',10],['大七度',11],['纯八度',12]
  ];
  const CHORDS = {
    major:['大三和弦',[0,4,7]], minor:['小三和弦',[0,3,7]], augmented:['增三和弦',[0,4,8]], diminished:['减三和弦',[0,3,6]],
    maj7:['大七和弦',[0,4,7,11]], min7:['小七和弦',[0,3,7,10]], dom7:['属七和弦',[0,4,7,10]], halfdim7:['半减七和弦',[0,3,6,10]], dim7:['减七和弦',[0,3,6,9]]
  };
  const NOTE_OPTIONS = Array.from({length:25},(_,i)=>48+i).map(m=>`<option value="${m}">${['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][m%12]}${Math.floor(m/12)-1}</option>`).join('');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  const section = document.createElement('section');
  section.id = 'questions'; section.className = 'tab tw-page'; section.hidden = true;
  section.innerHTML = `
    <header class="tw-hero">
      <div><span>HAITANG EXAM · TEACHER DESK</span><h1>教师工作台</h1><p>管理训练题库、制作音乐试题、组织套题，并实时核对学生端效果。</p></div>
      <div class="tw-hero-actions"><button type="button" data-new>＋ 新建试题</button><button type="button" data-refresh class="ghost">刷新题库</button></div>
    </header>
    <div class="tw-actions">
      <button type="button" data-new><b>＋</b><span>新建试题<small>选择专属音乐出题器</small></span></button>
      <button type="button" data-quick><b>⚡</b><span>快速出题<small>批量生成音程听辨草稿</small></span></button>
      <button type="button" data-new-paper><b>▤</b><span>新建套题<small>组合听音、听记、乐理与视唱</small></span></button>
      <button type="button" data-manage-bank><b>库</b><span>训练题库管理<small>统一检查乐理、听记与套题</small></span></button>
    </div>
    <div class="tw-metrics">
      <article><span>题库总数</span><strong id="twTotal">—</strong></article><article><span>听音题</span><strong id="twDictation">—</strong></article><article><span>乐理题</span><strong id="twTheory">—</strong></article><article><span>视唱题</span><strong id="twSight">—</strong></article>
    </div>
    <section class="tw-library" id="twBankManager">
      <div class="tw-library-head"><div><span>TRAINING QUESTION BANK</span><h2>训练题库管理</h2><p id="twBankScope">读取权限中…</p><button type="button" id="twSyncBank" class="tw-sync-bank" hidden>同步全部内置题目</button></div><div class="tw-bank-tabs"><button type="button" class="active" data-bank-mode="theory">乐理训练</button><button type="button" data-bank-mode="dictation">听记训练</button><button type="button" data-bank-mode="sets">套题管理</button></div></div>
      <div class="tw-filters"><select id="twDifficulty"><option value="">全部难度</option><option value="1">难度 1</option><option value="2">难度 2</option><option value="3">难度 3</option><option value="4">难度 4</option><option value="5">难度 5</option></select><select id="twStatus"><option value="">全部状态</option><option value="draft">草稿</option><option value="submitted">待审</option><option value="published">已发布</option><option value="changes_requested">需修改</option><option value="archived">已停用 / 回收站</option></select><input id="twSearch" placeholder="搜索题干、知识点或来源"><button type="button" id="twSearchButton">查询</button></div>
      <div id="twQuestionList" class="tw-question-list"><p class="tw-empty">正在读取题库…</p></div>
    </section>`;
  document.getElementById('dashboard').append(section);

  const typeDialog = document.createElement('dialog');
  typeDialog.className = 'tw-type-dialog';
  typeDialog.innerHTML = `<div class="tw-type-head"><div><span>NEW MUSIC QUESTION</span><h2>你今天想出什么题？</h2><p>先选择题型，工作台会自动准备对应的音乐编辑器。</p></div><button type="button" data-close aria-label="关闭">×</button></div><div class="tw-type-groups">${[...new Set(Object.values(TYPES).map(t=>t.group))].map(group=>`<section><h3>${group}</h3><div>${Object.entries(TYPES).filter(([,t])=>t.group===group).map(([key,t])=>`<button type="button" data-type="${key}"><i>${t.icon}</i><b>${t.label}</b><span>${t.subject==='theory'?'知识与符号':'音频、谱面与答案'}</span></button>`).join('')}</div></section>`).join('')}</div>`;
  document.body.append(typeDialog);

  const quickDialog = document.createElement('dialog');
  quickDialog.className = 'tw-type-dialog tw-quick-dialog';
  quickDialog.innerHTML = `<form><div class="tw-type-head"><div><span>QUICK AUTHORING</span><h2>批量生成音程听辨</h2><p>生成后进入“我的题库”逐题试听和审核，不会未经确认直接发布。</p></div><button type="button" data-close aria-label="关闭">×</button></div><div class="tw-quick-body"><label>生成数量<input name="count" type="number" min="1" max="30" value="10"></label><label>音区下限<select name="minRoot">${NOTE_OPTIONS}</select></label><label>音区上限<select name="maxRoot">${NOTE_OPTIONS}</select></label><fieldset><legend>音程范围</legend>${INTERVALS.slice(0,8).map(([name,semitones],index)=>`<label><input type="checkbox" name="interval" value="${semitones}" ${index<5?'checked':''}>${name}</label>`).join('')}</fieldset><fieldset><legend>播放方式</legend><label><input type="checkbox" name="mode" value="up" checked>上行</label><label><input type="checkbox" name="mode" value="down" checked>下行</label><label><input type="checkbox" name="mode" value="harmonic" checked>和声</label></fieldset><button>生成草稿</button><p class="tw-quick-status"></p></div></form>`;
  document.body.append(quickDialog);
  quickDialog.querySelector('[name="minRoot"]').value='48';
  quickDialog.querySelector('[name="maxRoot"]').value='72';

  const editor = document.createElement('dialog');
  editor.className = 'tw-editor';
  editor.innerHTML = `<form id="twEditorForm">
    <header class="tw-editor-head"><button type="button" data-close>← 返回题库</button><div><span id="twEditorKicker">NEW QUESTION</span><h2 id="twEditorTitle">新建试题</h2></div><div class="tw-save-cluster"><span id="twSaveState">已保存</span><button type="button" data-save class="ghost">保存草稿</button><button type="button" data-publish>发布试题</button></div></header>
    <nav class="tw-mobile-tabs" aria-label="编辑区域"><button type="button" data-pane="settings">设置</button><button type="button" class="active" data-pane="edit">编辑</button><button type="button" data-pane="preview">预览</button></nav>
    <div class="tw-editor-grid">
      <aside class="tw-settings" data-pane-panel="settings">
        <span class="tw-step">01 / QUESTION TYPE</span><h3>题型与规则</h3>
        <div id="twTypeRail" class="tw-type-rail"></div>
        <label>难度<select name="difficulty"><option value="1">★☆☆☆☆</option><option value="2">★★☆☆☆</option><option value="3">★★★☆☆</option><option value="4">★★★★☆</option><option value="5">★★★★★</option></select></label>
        <label>知识点<input name="knowledgeId" required placeholder="例如 dictation-interval-01"></label>
        <label>分值<input name="score" type="number" min="1" max="100" value="2"></label>
        <label>播放次数<input name="playCount" type="number" min="1" max="10" value="3"></label>
        <label>作答限时（秒）<input name="timeLimit" type="number" min="0" max="3600" value="20"><small>填 0 表示不限时</small></label>
      </aside>
      <main class="tw-compose" data-pane-panel="edit">
        <span class="tw-step">02 / MUSIC QUESTION</span><h3>试题编辑区</h3>
        <label class="tw-field">题目指令<textarea name="prompt" rows="2" required></textarea></label>
        <section id="twSpecific" class="tw-specific"></section>
        <section id="twMusicPaper" class="tw-paper"><div class="tw-paper-label"><span>音乐内容编辑器</span><button type="button" data-play>▶ 试听</button></div><div id="twMusicEditor"></div></section>
        <div class="tw-answer-grid"><label>选项（每行一个）<textarea name="options" rows="5"></textarea></label><label>正确答案<textarea name="answer" rows="5" required></textarea></label></div>
        <label class="tw-field">题目解析<textarea name="explanation" rows="3" placeholder="学生提交后显示的解析"></textarea></label>
      </main>
      <aside class="tw-preview" data-pane-panel="preview"><span class="tw-step">03 / STUDENT VIEW</span><h3>学生端实时预览</h3><div id="twStudentPreview" class="tw-student-card"></div></aside>
    </div>
  </form>`;
  document.body.append(editor);

  const style = document.createElement('style'); style.id = 'teacher-workbench-styles';
  style.textContent = `
    :root{--tw-ink:#45271e;--tw-accent:#e76531;--tw-paper:#fffdf9;--tw-wash:#f7eee4;--tw-line:#decfc1;--tw-muted:#8b756a}
    .tw-page{background:transparent!important}.tw-hero{display:flex;justify-content:space-between;gap:24px;align-items:end;padding:8px 0 28px;border-bottom:1px solid var(--tw-line)}.tw-hero span,.tw-library-head span,.tw-step,.tw-type-head span{font:700 11px/1.2 ui-monospace,monospace;letter-spacing:.17em;color:var(--tw-accent)}.tw-hero h1{margin:8px 0 6px;font:500 clamp(36px,5vw,68px)/1 Georgia,"Songti SC",serif;color:var(--tw-ink)}.tw-hero p{margin:0;color:var(--tw-muted)}.tw-hero-actions{display:flex;gap:10px}.tw-hero button,.tw-library button,.tw-editor button,.tw-type-dialog button{border:0;border-radius:999px;padding:11px 18px;background:var(--tw-accent);color:#fff;font-weight:750;cursor:pointer}.tw-hero button.ghost,.tw-editor button.ghost{background:#fff;color:var(--tw-ink);border:1px solid var(--tw-line)}
    .tw-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.tw-actions>button{display:flex;align-items:center;gap:13px;padding:17px;border:1px solid var(--tw-line);border-radius:15px;background:var(--tw-paper);color:var(--tw-ink);text-align:left}.tw-actions b{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--tw-ink);color:#fff}.tw-actions span,.tw-actions small{display:block}.tw-actions small{margin-top:4px;color:var(--tw-muted)}.tw-actions button:disabled{opacity:.52;cursor:not-allowed}.tw-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;overflow:hidden;border:1px solid var(--tw-line);border-radius:16px;background:var(--tw-line)}.tw-metrics article{padding:18px 20px;background:var(--tw-paper)}.tw-metrics span{display:block;color:var(--tw-muted);font-size:13px}.tw-metrics strong{display:block;margin-top:7px;font:500 34px Georgia,serif;color:var(--tw-ink)}
    .tw-library{margin-top:24px;padding:22px;border:1px solid var(--tw-line);border-radius:18px;background:rgba(255,253,249,.85)}.tw-library-head{display:flex;align-items:end;justify-content:space-between;gap:20px}.tw-library h2{margin:5px 0 0;font:500 30px Georgia,"Songti SC",serif}.tw-library-head p{margin:6px 0 0;color:var(--tw-muted);font-size:12px}.tw-sync-bank{margin-top:10px;padding:7px 12px!important;font-size:12px}.tw-bank-tabs{display:flex;gap:7px;padding:5px;border-radius:999px;background:var(--tw-wash)}.tw-bank-tabs button{padding:8px 14px;background:transparent;color:var(--tw-ink)}.tw-bank-tabs button.active{background:var(--tw-accent);color:#fff}.tw-filters{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.tw-filters input,.tw-filters select,.tw-settings input,.tw-settings select,.tw-compose input,.tw-compose select,.tw-compose textarea{border:1px solid var(--tw-line);border-radius:10px;background:#fff;padding:10px 11px;color:var(--tw-ink);font:inherit}.tw-question-list{display:grid;gap:9px;margin-top:18px}.tw-question{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:15px 16px;border:1px solid #eadfd5;border-radius:13px;background:#fff}.tw-question h3{margin:0 0 6px;font-size:16px}.tw-question p{margin:0;color:var(--tw-muted);font-size:12px}.tw-question aside{display:flex;align-items:center;gap:10px}.tw-question button:disabled{opacity:.55;cursor:not-allowed}.tw-status{padding:5px 9px;border-radius:999px;background:var(--tw-wash);font-size:12px;color:var(--tw-ink)}.tw-empty{padding:30px;text-align:center;color:var(--tw-muted)}
    .tw-type-dialog{width:min(1000px,calc(100% - 28px));max-height:calc(100dvh - 28px);padding:0;border:0;border-radius:22px;background:#fbf7f1;color:var(--tw-ink)}.tw-type-dialog::backdrop,.tw-editor::backdrop{background:rgba(43,27,20,.64);backdrop-filter:blur(8px)}.tw-type-head{display:flex;justify-content:space-between;padding:28px 30px 20px;border-bottom:1px solid var(--tw-line)}.tw-type-head h2{margin:7px 0;font:500 38px Georgia,"Songti SC",serif}.tw-type-head p{margin:0;color:var(--tw-muted)}.tw-type-head [data-close]{align-self:start;background:transparent;color:var(--tw-ink);font-size:28px;padding:0}.tw-type-groups{padding:12px 30px 30px;overflow:auto}.tw-type-groups h3{margin:20px 0 10px;font-size:13px;color:var(--tw-muted)}.tw-type-groups section>div{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.tw-type-groups [data-type]{display:grid;justify-items:start;gap:6px;min-height:126px;padding:17px;border:1px solid var(--tw-line);border-radius:15px;background:#fff;color:var(--tw-ink);text-align:left}.tw-type-groups [data-type]:hover{border-color:var(--tw-accent);transform:translateY(-2px)}.tw-type-groups i{font:normal 28px Georgia,serif;color:var(--tw-accent)}.tw-type-groups span{color:var(--tw-muted);font-size:12px}.tw-quick-body{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:24px 30px 30px}.tw-quick-body>label{display:grid;gap:6px}.tw-quick-body input,.tw-quick-body select{padding:10px;border:1px solid var(--tw-line);border-radius:9px}.tw-quick-body fieldset{grid-column:span 3;display:flex;gap:14px;flex-wrap:wrap;border:1px solid var(--tw-line);border-radius:12px;padding:14px}.tw-quick-body>button,.tw-quick-status{grid-column:span 3}.tw-quick-body>button{min-height:44px}.tw-quick-status{min-height:20px;color:var(--tw-accent)}
    .tw-editor{width:calc(100% - 24px);height:calc(100dvh - 24px);max-width:none;max-height:none;padding:0;border:0;border-radius:20px;background:#f2dfd2;color:var(--tw-ink);overflow:hidden}.tw-editor form{height:100%;display:flex;flex-direction:column}.tw-editor-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;min-height:74px;padding:10px 18px;background:#fffaf5;border-bottom:1px solid var(--tw-line)}.tw-editor-head>button{justify-self:start;background:transparent;color:var(--tw-ink);padding-left:0}.tw-editor-head>div:nth-child(2){text-align:center}.tw-editor-head h2{margin:3px 0 0;font:500 22px Georgia,"Songti SC",serif}.tw-save-cluster{justify-self:end;display:flex;align-items:center;gap:9px}.tw-save-cluster>span{font-size:12px;color:var(--tw-muted)}.tw-editor-grid{display:grid;grid-template-columns:250px minmax(480px,1fr) minmax(280px,360px);flex:1;min-height:0}.tw-settings,.tw-compose,.tw-preview{min-height:0;overflow:auto;padding:22px}.tw-settings{background:#f7e7dc;border-right:1px solid var(--tw-line)}.tw-settings h3,.tw-compose h3,.tw-preview h3{margin:7px 0 18px;font:500 25px Georgia,"Songti SC",serif}.tw-settings>label{display:grid;gap:6px;margin-top:14px;font-size:13px}.tw-settings label small{color:var(--tw-muted)}.tw-type-rail{display:grid;gap:6px}.tw-type-rail button{display:flex;align-items:center;gap:8px;width:100%;padding:9px 11px;border-radius:9px;background:transparent;color:var(--tw-ink);text-align:left}.tw-type-rail button.active{background:var(--tw-accent);color:#fff}.tw-compose{background:#fff7f0}.tw-field,.tw-answer-grid label{display:grid;gap:7px;font-size:13px}.tw-specific{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.tw-specific label{display:grid;gap:6px;font-size:12px}.tw-paper{max-width:860px;margin:18px auto;padding:16px;border-radius:4px;background:var(--tw-paper);box-shadow:0 15px 38px rgba(111,52,28,.13)}.tw-paper-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;color:var(--tw-muted);font-size:12px}.tw-paper-label button{padding:8px 14px}.tw-answer-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.tw-preview{background:#f2dfd2;border-left:1px solid var(--tw-line)}.tw-student-card{min-height:420px;padding:24px 20px;border-radius:16px;background:#fff;box-shadow:0 10px 30px rgba(111,52,28,.1)}.tw-student-card .student-count{font:700 11px ui-monospace,monospace;letter-spacing:.12em;color:var(--tw-muted)}.tw-student-card h4{margin:24px 0 18px;font:500 21px/1.5 Georgia,"Songti SC",serif}.tw-student-score{margin:12px -8px;padding:8px;border-radius:10px;background:#fffaf6}.tw-student-options{display:grid;gap:8px}.tw-student-options div{padding:11px 12px;border:1px solid #ead3c4;border-radius:10px}.tw-student-meta{display:flex;justify-content:space-between;margin-top:16px;color:var(--tw-muted);font-size:12px}.tw-student-play{width:100%;margin-top:8px}.tw-mobile-tabs{display:none}
    @media(max-width:1120px){.tw-editor-grid{grid-template-columns:220px minmax(450px,1fr) 300px}.tw-actions{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:760px){.tw-hero,.tw-library-head{align-items:stretch;flex-direction:column}.tw-hero{display:flex}.tw-actions,.tw-metrics{grid-template-columns:1fr 1fr}.tw-filters>*{flex:1;min-width:130px}.tw-type-groups section>div{grid-template-columns:1fr 1fr}.tw-editor{width:100%;height:100dvh;border-radius:0}.tw-editor-head{grid-template-columns:auto 1fr}.tw-editor-head>div:nth-child(2){text-align:left}.tw-save-cluster{grid-column:1/-1;justify-self:stretch;justify-content:flex-end}.tw-editor-head{min-height:112px}.tw-mobile-tabs{display:grid;grid-template-columns:repeat(3,1fr);padding:7px;background:#fffdf9;border-bottom:1px solid var(--tw-line)}.tw-mobile-tabs button{border-radius:8px;background:transparent;color:var(--tw-ink)}.tw-mobile-tabs button.active{background:var(--tw-ink);color:#fff}.tw-editor-grid{display:block;overflow:auto}.tw-editor-grid>[data-pane-panel]{display:none;height:100%;border:0}.tw-editor-grid>[data-pane-panel].mobile-active{display:block}.tw-answer-grid{grid-template-columns:1fr}.tw-specific{grid-template-columns:1fr 1fr}.tw-question{grid-template-columns:1fr}.tw-question aside{justify-content:space-between}}
    @media(prefers-reduced-motion:no-preference){.tw-type-groups [data-type],.tw-question{transition:.18s ease}.tw-question:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(79,49,34,.08)}}`;
  document.head.append(style);

  let csrfToken = '', current = null, currentType = 'interval', dirty = false, loadingEditor = false, bankMode = 'theory';
  const form = editor.querySelector('#twEditorForm');
  const saveState = editor.querySelector('#twSaveState');
  async function csrf(){ if(csrfToken)return csrfToken; csrfToken=(await(await fetch('/api/csrf')).json()).csrfToken; return csrfToken; }
  async function api(url,options={}){ const method=options.method||'GET',headers={...(options.headers||{})}; if(!['GET','HEAD'].includes(method))headers['x-csrf-token']=await csrf(); const response=await fetch(url,{...options,headers}); const body=response.status===204?null:await response.json().catch(()=>({})); if(!response.ok)throw Error(body?.message||body?.error||'请求失败'); return body; }
  const setDirty = value => { dirty=value; saveState.textContent=value?'有未保存更改':'已保存'; saveState.classList.toggle('dirty',value); };
  const inferType = question => question?.content?.musicType || (question?.subject==='sight_singing'?'sight_singing':question?.subject==='theory'?'theory_choice':question?.content?.category||'single_note');
  const genericQuestionType = type => ['melody','sight_singing'].includes(type)?'text_input':'single_choice';

  async function loadBank(){
    const list=document.getElementById('twQuestionList'),manager=window.CONTENT_MANAGER||{};
    document.getElementById('twBankScope').textContent=manager.role==='admin'?'总管理员教师 · 可管理海棠艺考全部训练题库':'普通教师 · 可查看全部题库，只能修改自己创建的题目';
    document.getElementById('twSyncBank').hidden=manager.role!=='admin';
    if(bankMode==='sets'){
      const data=await api('/api/teaching/gaokao/sets');
      list.innerHTML=data.items.map(item=>`<article class="tw-question"><div><h3>▤ ${esc(item.title)}</h3><p>${item.section_count} 个部分 · ${item.total_score} 分 · 限时 ${item.estimated_duration||0} 分钟 · ${esc(STATUS[item.status]||item.status)}</p></div><aside><button type="button" data-open-sets>进入套题管理</button></aside></article>`).join('')||'<p class="tw-empty">暂无套题。点击上方“新建套题”开始组卷。</p>';
      return;
    }
    const query=new URLSearchParams({page:1,pageSize:500,systemCode:'gaokao',subject:bankMode,status:document.getElementById('twStatus').value,difficulty:document.getElementById('twDifficulty').value,search:document.getElementById('twSearch').value});
    const [data,dictation,theory,sight]=await Promise.all([api(`/api/admin/questions?${query}`),...['dictation','theory','sight_singing'].map(subject=>api(`/api/admin/questions?page=1&pageSize=1&systemCode=gaokao&subject=${subject}`))]);
    document.getElementById('twTotal').textContent=dictation.pagination.total+theory.pagination.total+sight.pagination.total;
    document.getElementById('twDictation').textContent=dictation.pagination.total;
    document.getElementById('twTheory').textContent=theory.pagination.total;
    document.getElementById('twSight').textContent=sight.pagination.total;
    list.innerHTML=data.items.map(q=>{const type=TYPES[inferType(q)]||TYPES.theory_choice,time=Number(q.content?.studentSettings?.timeLimit||q.content?.timeLimit||0),plays=Number(q.content?.audioSettings?.playCount||q.content?.playCount||0),updated=q.updated_at?new Date(q.updated_at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';return `<article class="tw-question"><div><h3>${type.icon} ${esc(q.content.prompt||'未命名题目')}</h3><p>${esc(type.label)} · ${esc(q.knowledge_id)} · 难度 ${q.difficulty} · ${time?`默认 ${time} 秒`:'不限时'}${bankMode==='dictation'&&plays?` · 播放 ${plays} 次`:''} · v${q.version_no} · ${updated}</p></div><aside><span class="tw-status">${STATUS[q.status]||esc(q.status)}</span><button type="button" data-edit="${q.id}" ${q.can_edit?'':'disabled'}>${q.can_edit?'修改题目':'只读'}</button></aside></article>`}).join('')||'<p class="tw-empty">没有符合条件的题目。点击“新建试题”开始制作。</p>';
  }

  async function generateQuickQuestions(event){
    event.preventDefault();
    const quickForm=event.currentTarget,fd=new FormData(quickForm),status=quickForm.querySelector('.tw-quick-status');
    const count=Math.max(1,Math.min(30,Number(fd.get('count')||10))),intervals=fd.getAll('interval').map(Number),modes=fd.getAll('mode');
    let minRoot=Number(fd.get('minRoot')||48),maxRoot=Number(fd.get('maxRoot')||72);if(minRoot>maxRoot)[minRoot,maxRoot]=[maxRoot,minRoot];
    if(!intervals.length||!modes.length){status.textContent='请至少选择一种音程和播放方式。';return}
    const submit=quickForm.querySelector('button[type="submit"],button:not([type])');submit.disabled=true;
    try{
      for(let index=0;index<count;index++){
        const semitones=intervals[Math.floor(Math.random()*intervals.length)],mode=modes[Math.floor(Math.random()*modes.length)],name=INTERVALS.find(([,value])=>value===semitones)?.[0]||'音程';
        const highestRoot=Math.max(minRoot,Math.min(maxRoot,72-semitones)),root=Math.floor(Math.random()*(highestRoot-minRoot+1))+minRoot,target=mode==='down'?Math.max(36,root-semitones):root+semitones,harmonic=mode==='harmonic';
        const notes=[{midi:root,dur:1,rest:false,...(harmonic?{simultaneous:true}:{})},{midi:target,dur:1,rest:false,...(harmonic?{simultaneous:true}:{})}];
        const distractors=INTERVALS.map(([label])=>label).filter(label=>label!==name).sort(()=>Math.random()-.5).slice(0,3),options=[name,...distractors].sort(()=>Math.random()-.5);
        await api('/api/admin/questions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({systemCode:'gaokao',subject:'dictation',difficulty:3,knowledgeId:`dictation-interval-quick-${Date.now()}-${index}`,questionType:'single_choice',sourceLabel:'教师快速出题',saveMode:'draft',content:{prompt:'请听下面两个音，判断它们构成的音程。',options,answer:name,explanation:`这两个音构成${name}。`,musicType:'interval',musicData:{notes,keySignature:'C',meter:'4/4',tempo:100,category:harmonic?'interval':'melody',clef:'treble',parameters:{root,semitones,playMode:harmonic?'harmonic':'melodic',direction:mode==='down'?'down':'up'}},audioSettings:{timbre:'piano-sample',playCount:3,playMode:harmonic?'harmonic':'melodic',direction:mode==='down'?'down':'up'},studentSettings:{score:2,timeLimit:20}}})});
        status.textContent=`正在生成 ${index+1} / ${count}…`;
      }
      status.textContent=`已生成 ${count} 道草稿，请在题库中逐题审核。`;await loadBank();setTimeout(()=>quickDialog.close(),900);
    }catch(error){status.textContent=error.message}finally{submit.disabled=false}
  }

  function renderTypeRail(){ document.getElementById('twTypeRail').innerHTML=Object.entries(TYPES).map(([key,type])=>`<button type="button" data-type="${key}" class="${key===currentType?'active':''}"><span>${type.icon}</span>${type.label}</button>`).join(''); }
  function defaultOptions(type){
    if(type==='interval') return '小三度\n大三度\n大二度\n纯四度';
    if(type==='chord') return '大三和弦\n小三和弦\n增三和弦\n减三和弦';
    if(type==='single_note') return 'C4\nD4\nE4\nF4';
    if(type==='theory_choice'||type==='guitar') return '选项 A\n选项 B\n选项 C\n选项 D';
    return '';
  }
  function specificHTML(type){
    if(type==='single_note') return `<label>音高<select data-param="root">${NOTE_OPTIONS}</select></label><label>音色<select><option>钢琴采样</option></select></label><label>答案类型<select><option>音名</option><option>唱名</option></select></label>`;
    if(type==='interval') return `<label>根音<select data-param="root">${NOTE_OPTIONS}</select></label><label>音程<select data-param="interval">${INTERVALS.map(([n,s])=>`<option value="${s}">${n}</option>`).join('')}</select></label><label>音程模式<select data-param="playMode"><option value="melodic">旋律音程（先后弹响）</option><option value="harmonic">和声音程（同时弹响）</option></select></label><label>方向<select data-param="direction"><option value="up">上行</option><option value="down">下行</option></select></label><label><span>&nbsp;</span><button type="button" data-distractors>自动生成干扰项</button></label>`;
    if(type==='chord') return `<label>根音<select data-param="root">${NOTE_OPTIONS}</select></label><label>和弦性质<select data-param="quality">${Object.entries(CHORDS).map(([key,[name]])=>`<option value="${key}">${name}</option>`).join('')}</select></label><label>转位<select data-param="inversion"><option value="0">原位</option><option value="1">第一转位</option><option value="2">第二转位</option><option value="3">第三转位</option></select></label><label><span>&nbsp;</span><button type="button" data-distractors>自动生成干扰项</button></label>`;
    if(type==='melody'||type==='sight_singing') return `<label>调号<select data-info="key"><option>C / a 小调</option><option>G / e 小调</option><option>F / d 小调</option></select></label><label>建议小节数<input data-info="bars" type="number" min="1" max="32" value="4"></label><label>录入方式<select><option>鼠标 / 电脑键盘</option><option>MIDI 键盘</option></select></label>`;
    if(type==='rhythm') return `<label>拍号<select data-info="meter"><option>4/4</option><option>3/4</option><option>2/4</option><option>6/8</option></select></label><label>说明<span>使用下方休止符、时值和附点工具录入。</span></label>`;
    return `<label>答题形式<select><option>单项选择</option><option>判断题</option></select></label><label>谱面<select data-param="showMusic"><option value="no">纯文字</option><option value="yes">附五线谱</option></select></label>`;
  }
  function autoMusic(){
    const meta=TYPES[currentType], specific=document.getElementById('twSpecific');
    if(currentType==='single_note'){
      const root=Number(specific.querySelector('[data-param="root"]')?.value||60); form.elements.answer.value=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][root%12]+(Math.floor(root/12)-1); return [{midi:root,dur:1,rest:false}];
    }
    if(currentType==='interval'){
      const root=Number(specific.querySelector('[data-param="root"]')?.value||60), semitones=Number(specific.querySelector('[data-param="interval"]')?.value||3), direction=specific.querySelector('[data-param="direction"]')?.value||'up', harmonic=specific.querySelector('[data-param="playMode"]')?.value==='harmonic';
      const target=root+(direction==='down'?-semitones:semitones); form.elements.answer.value=INTERVALS.find(([,s])=>s===semitones)?.[0]||''; return [{midi:root,dur:1,rest:false,...(harmonic?{simultaneous:true}:{})},{midi:target,dur:1,rest:false,...(harmonic?{simultaneous:true}:{})}];
    }
    if(currentType==='chord'){
      const root=Number(specific.querySelector('[data-param="root"]')?.value||60), quality=specific.querySelector('[data-param="quality"]')?.value||'major', inversion=Number(specific.querySelector('[data-param="inversion"]')?.value||0), chord=CHORDS[quality]||CHORDS.major, pitches=chord[1].map(x=>root+x);
      for(let i=0;i<Math.min(inversion,pitches.length-1);i++)pitches[i]+=12; pitches.sort((a,b)=>a-b); form.elements.answer.value=chord[0]; return pitches.map(midi=>({midi,dur:2,rest:false,simultaneous:true}));
    }
    return window.MusicEditor?.getNotes?.()||[];
  }
  function mountMusic(notes){
    const paper=document.getElementById('twMusicPaper'), needsMusic=!['theory_choice','guitar'].includes(currentType)||document.querySelector('[data-param="showMusic"]')?.value==='yes';
    paper.hidden=!needsMusic;
    if(!needsMusic){window.MusicEditor?.destroy?.();renderPreview();return;}
    const playMode=document.querySelector('[data-param="playMode"]')?.value;
    const category=currentType==='interval'&&playMode==='melodic'?'melody':TYPES[currentType].category;
    window.MusicEditor?.mount(document.getElementById('twMusicEditor'),{notes:notes||[],keySignature:current?.content?.musicData?.keySignature||current?.content?.keySignature||'C',clef:current?.content?.musicData?.clef||current?.content?.clef||'treble',meter:current?.content?.musicData?.meter||current?.content?.meter||'4/4',bpm:current?.content?.musicData?.tempo||current?.content?.bpm||100,category,onChange:()=>{if(!loadingEditor){setDirty(true);renderPreview();}}});
  }
  function readParameters(){
    return Object.fromEntries([...document.querySelectorAll('#twSpecific [data-param]')].map(field=>[field.dataset.param,field.value]));
  }
  function restoreParameters(){
    const saved=current?.content?.musicData?.parameters||current?.content?.typeParameters||{};
    Object.entries(saved).forEach(([name,value])=>{const field=document.querySelector(`#twSpecific [data-param="${name}"]`);if(field)field.value=String(value)});
  }
  function generateDistractors(){
    const answer=form.elements.answer.value; let pool=[];
    if(currentType==='interval')pool=INTERVALS.map(([name])=>name); else if(currentType==='chord')pool=Object.values(CHORDS).map(([name])=>name); else return;
    const near=pool.filter(x=>x!==answer).sort(()=>Math.random()-.5).slice(0,3); form.elements.options.value=[answer,...near].sort(()=>Math.random()-.5).join('\n'); setDirty(true); renderPreview();
  }
  function renderPreview(){
    const prompt=form.elements.prompt.value||'请填写题目指令。', options=form.elements.options.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean), state=window.MusicEditor?.getState?.(), playCount=form.elements.playCount.value, timeLimit=Number(form.elements.timeLimit.value||0), score=form.elements.score.value, parameters=readParameters();
    document.getElementById('twStudentPreview').innerHTML=`<span class="student-count">QUESTION 01 / 01</span><h4>${esc(prompt)}</h4>${state?.notes?.length?`<div class="tw-student-score">${window.MusicEditor.renderStaffPreview(state.notes,state.keySignature,state.meter,state.category,state.clef)}</div><button type="button" class="tw-student-play" data-preview-play>▶ 播放题目</button>`:''}<div class="tw-student-options">${options.map((o,i)=>`<div>${String.fromCharCode(65+i)}. ${esc(o)}</div>`).join('')}</div><div class="tw-student-meta"><span>播放 ${playCount} 次</span><span>${timeLimit?`限时 ${timeLimit} 秒`:'不限时'} · ${score} 分</span></div>`;
    document.querySelector('[data-preview-play]')?.addEventListener('click',()=>window.MusicEditor?.playNotes?.(state.notes,{bpm:state.bpm,simultaneous:currentType==='chord'||parameters.playMode==='harmonic'}));
  }
  function switchType(type, preserve=false){
    currentType=type; const meta=TYPES[type]; renderTypeRail(); document.getElementById('twEditorTitle').textContent=`${current?'编辑':'新建'}：${meta.label}`; document.getElementById('twSpecific').innerHTML=specificHTML(type);
    if(!preserve){form.elements.prompt.value=meta.prompt;form.elements.options.value=defaultOptions(type);form.elements.answer.value=meta.answer;form.elements.knowledgeId.value=`${meta.subject}-${type.replace('_','-')}-${String(Date.now()).slice(-6)}`;} else restoreParameters();
    const saved=current?.content?.musicData?.notes||current?.content?.notes||[]; mountMusic(preserve&&saved.length?saved:autoMusic());
    document.getElementById('twSpecific').onchange=event=>{if(event.target.matches('[data-param]')){mountMusic(autoMusic())}setDirty(true);renderPreview()};
    document.querySelector('[data-distractors]')?.addEventListener('click',generateDistractors);
    document.querySelector('[data-param="showMusic"]')?.addEventListener('change',()=>mountMusic([]));
    renderPreview();
  }
  function openEditor(type, question=null){
    current=question; loadingEditor=true; currentType=type; const c=question?.content||{};
    form.elements.difficulty.value=question?.difficulty||2; form.elements.knowledgeId.value=question?.knowledge_id||''; form.elements.score.value=c.studentSettings?.score||c.score||2; form.elements.playCount.value=c.audioSettings?.playCount||c.playCount||3; form.elements.timeLimit.value=c.studentSettings?.timeLimit||c.timeLimit||20; form.elements.prompt.value=c.prompt||TYPES[type].prompt; form.elements.options.value=Array.isArray(c.options)?c.options.join('\n'):defaultOptions(type); form.elements.answer.value=Array.isArray(c.answer)?c.answer.join('|'):(c.answer??TYPES[type].answer); form.elements.explanation.value=c.explanation||'';
    document.getElementById('twEditorKicker').textContent=question?`QUESTION #${question.id} · ${STATUS[question.status]||question.status}`:'NEW MUSIC QUESTION';
    switchType(type,true); setDirty(false); loadingEditor=false; editor.showModal(); document.querySelector('[data-pane="edit"]').click();
  }
  function payload(){
    const type=TYPES[currentType], state=window.MusicEditor?.getState?.()||{notes:[],keySignature:'C',meter:'4/4',bpm:100,category:type.category}, options=form.elements.options.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const parameters=readParameters();
    return {systemCode:'gaokao',subject:type.subject,instrument:currentType==='guitar'?'吉他':'',difficulty:Number(form.elements.difficulty.value),knowledgeId:form.elements.knowledgeId.value,questionType:genericQuestionType(currentType),sourceLabel:current?.source_label||'教师工作台',saveMode:'draft',content:{...(current?.content?.sourceId?{sourceId:current.content.sourceId}:{}),category:current?.content?.category||state.category,prompt:form.elements.prompt.value,options,answer:form.elements.answer.value,explanation:form.elements.explanation.value,musicType:currentType,musicData:{notes:state.notes,keySignature:state.keySignature,meter:state.meter,tempo:state.bpm,category:state.category,clef:state.clef,parameters},audioSettings:{timbre:'piano-sample',playCount:Number(form.elements.playCount.value),playMode:parameters.playMode||'',direction:parameters.direction||''},studentSettings:{score:Number(form.elements.score.value),timeLimit:Number(form.elements.timeLimit.value)},notes:state.notes,keySignature:state.keySignature,clef:state.clef,meter:state.meter,bpm:state.bpm,category:state.category}};
  }
  async function saveDraft(){
    if(!form.reportValidity())throw Error('请先完成必填内容。'); saveState.textContent='正在保存…'; const body=payload(); const result=await api(current?`/api/admin/questions/${current.id}`:'/api/admin/questions',{method:current?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    if(!current){current=(await api(`/api/admin/questions/${result.id}`)).question}else{current={...current,...body,content:body.content,version_no:result.version,status:'draft'}} setDirty(false); document.getElementById('twEditorKicker').textContent=`QUESTION #${current.id} · 草稿`; await loadBank(); return current;
  }
  async function publish(){
    try{await saveDraft();saveState.textContent='正在发布…';await api(`/api/admin/questions/${current.id}/review`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'publish',notes:''})});current.status='published';setDirty(false);saveState.textContent='已发布';document.getElementById('twEditorKicker').textContent=`QUESTION #${current.id} · 已发布`;await loadBank()}catch(error){saveState.textContent=error.message;throw error}
  }
  async function openById(id){const q=(await api(`/api/admin/questions/${id}`)).question;openEditor(inferType(q),q)}

  const openSetManager=()=>{document.querySelector('[data-tab="teaching"]')?.click();setTimeout(()=>document.querySelector('.set-builder')?.scrollIntoView({behavior:'smooth',block:'start'}),100)};
  section.onclick=event=>{if(event.target.closest('[data-new]'))typeDialog.showModal();if(event.target.closest('[data-quick]'))quickDialog.showModal();if(event.target.closest('[data-new-paper],[data-open-sets]'))openSetManager();if(event.target.closest('[data-manage-bank]'))document.getElementById('twBankManager').scrollIntoView({behavior:'smooth',block:'start'});if(event.target.closest('[data-refresh]'))loadBank();const mode=event.target.closest('[data-bank-mode]');if(mode){bankMode=mode.dataset.bankMode;section.querySelectorAll('[data-bank-mode]').forEach(button=>button.classList.toggle('active',button===mode));document.querySelector('.tw-filters').hidden=bankMode==='sets';loadBank()}const edit=event.target.closest('[data-edit]');if(edit&&!edit.disabled)openById(edit.dataset.edit)};
  typeDialog.querySelector('[data-close]').onclick=()=>typeDialog.close(); typeDialog.onclick=event=>{const target=event.target.closest('[data-type]');if(target){typeDialog.close();openEditor(target.dataset.type)}};
  quickDialog.querySelector('[data-close]').onclick=()=>quickDialog.close();quickDialog.querySelector('form').onsubmit=generateQuickQuestions;
  document.getElementById('twSearchButton').onclick=loadBank; document.getElementById('twDifficulty').onchange=loadBank; document.getElementById('twStatus').onchange=loadBank;
  document.getElementById('twSyncBank').onclick=async event=>{const button=event.currentTarget;if(!confirm('把乐理和听记两大板块的全部内置题目同步到云端题库吗？已同步的题目不会重复。'))return;button.disabled=true;button.textContent='正在同步…';try{const result=await api('/api/admin/questions/import-training-bank',{method:'POST'});button.textContent=`完成：新增 ${result.imported} 道`;await loadBank()}catch(error){button.textContent=error.message}finally{setTimeout(()=>{button.disabled=false;button.textContent='同步全部内置题目'},2200)}};
  document.getElementById('twTypeRail').onclick=event=>{const target=event.target.closest('[data-type]');if(target&&target.dataset.type!==currentType){if(dirty&&!confirm('切换题型会重置当前音乐内容，继续吗？'))return;switchType(target.dataset.type)}};
  form.addEventListener('input',()=>{if(!loadingEditor){setDirty(true);renderPreview()}}); form.addEventListener('change',()=>{if(!loadingEditor){setDirty(true);renderPreview()}});
  editor.querySelector('[data-play]').onclick=()=>{const parameters=readParameters();window.MusicEditor?.playNotes?.(window.MusicEditor.getNotes(),{bpm:window.MusicEditor.getState().bpm,simultaneous:currentType==='chord'||parameters.playMode==='harmonic'})};
  editor.querySelector('[data-save]').onclick=()=>saveDraft().catch(error=>saveState.textContent=error.message); editor.querySelector('[data-publish]').onclick=()=>publish().catch(()=>{});
  editor.querySelector('[data-close]').onclick=()=>{if(dirty&&!confirm('还有未保存更改，确定返回题库吗？'))return;editor.close()};
  editor.addEventListener('cancel',event=>{if(dirty&&!confirm('还有未保存更改，确定关闭吗？'))event.preventDefault()});
  editor.addEventListener('close',()=>window.MusicEditor?.destroy?.());
  window.addEventListener('pagehide',()=>window.MusicEditor?.stopPlayback?.());
  editor.querySelectorAll('.tw-mobile-tabs button').forEach(button=>button.onclick=()=>{editor.querySelectorAll('.tw-mobile-tabs button').forEach(x=>x.classList.toggle('active',x===button));editor.querySelectorAll('[data-pane-panel]').forEach(x=>x.classList.toggle('mobile-active',x.dataset.panePanel===button.dataset.pane))});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
  tab.onclick=loadBank;
})();
