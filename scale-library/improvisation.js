(() => {
  'use strict';
  const D=window.HetianScaleStudio;
  if(!D)return;
  const {H,S,I,state,root,scale,escape,option,action,select,scaleOptions,chordOptions,fretboard,play,backing,stop,status,render,
    getStore,persist,replaceStore,updatePalette,openReview,steps}=D;
  const styles=['Pop','Blues','Blues Rock','Jazz','Swing','Funk','Neo Soul','Bossa Nova','Modal Jazz'];
  const presets=[...H.presets,{name:'Modal Jazz',mode:'minor',source:'1m7 1m7 ♭2m7 ♭2m7'}];
  const config={preset:0, source:presets[0].source, mode:presets[0].mode, style:'Jazz', bpm:95,
    meter:'4/4', swing:0, bars:4, position:'fixed', from:5, difficulty:0, scale:'auto', material:'scale',
    loop:true, chords:true, bass:true, metro:true};
  let active=0, parsed=[], activeLick=null;
  const totalBars=()=>Math.min(32,Math.max(1,Math.floor(Number(config.bars)||4)));
  function resolve() {
    const chords=H.parse(config.source,root(),config.mode).map(item=>H.resolve(item,root(),config.mode));
    return Array.from({length:totalBars()},(_,i)=>chords[i%chords.length]);
  }
  function choosePosition(chord, previous) {
    const from=I.clamp(config.from,20);
    if(config.position==='fixed')return from;
    const options=[4,5,6].flatMap(string=>H.voicings(chord.root,chord.type,string));
    const best=options.sort((a,b)=>{
      const anchor=shape=>Math.min(...shape.frets.filter(fret=>fret>=0));
      return Math.abs(anchor(a)-previous)-Math.abs(anchor(b)-previous);
    })[0];
    if(!best)return previous;
    return Math.min(20,Math.min(...best.frets.filter(fret=>fret>=0)));
  }
  function buildBars(){
    let previous = I.clamp(config.from,20);
    return resolve().map(chord=>{
      const from=choosePosition(chord,previous);
      previous=from;
      const rootMidi=36+chord.root.pc;
      let offers=I.compatible(chord,root(),config.mode);
      const emphasis = /Blues|Rock/.test(config.style)?['minor-blues','major-blues','mixolydian'] :
        /Jazz|Swing|Bossa/.test(config.style)?['dorian','mixolydian','phrygian-dom','lydian-dom','altered'] :
        /Neo/.test(config.style)?['dorian','jazz-minor','major-pent'] : ['major','minor','major-pent','minor-pent'];
      offers=offers.map(item=>({...item,score:item.score+(emphasis.includes(item.scale.id)?1.1:0)}));
      offers.sort((a,b)=>Number(b.exact)-Number(a.exact)||b.score-a.score);
      return {value:chord, chord:I.material(chord.root,chord.type).map(n=>48+chord.root.pc+n.pitch), bass:rootMidi, from,
        offers};
    });
  }
  function syncBars() {
    try { parsed=buildBars(); active=Math.min(active,parsed.length-1); return ''; }
    catch(error){ parsed=[]; return escape(error.message); }
  }
  function suitableLicks(bar) {
    return getStore().licks.filter(lick=>{
      const source=lick.chord?.trim().split(/[\s,，|]+/)||[];
      return source.some(tag=>tag===bar.value.id||tag===H.suffixLabel(bar.value.id)||tag===bar.value.name||
        (()=>{try{return H.parse(tag,bar.value.root)[0].id===bar.value.id;}catch(_){return false;}})());
    });
  }
  function makeHint(bar){
    if(!bar)return '';
    const index=active, chord=bar.value;
    if(config.difficulty===3)return '';
    if(config.difficulty===2)return `<article class="ss-card"><h3>当前和弦 ${escape(chord.name)}</h3></article>`;
    const activeScale = config.scale==='auto' ? bar.offers[0]?.scale||scale() : S.byId.get(config.scale)||scale();
    const chordTones = I.material(chord.root,chord.type);
    const scaleNotes = S.tones(chord.root,activeScale);
    const targets=chordTones.map(n=>n.pc);
    const notes = config.material==='arp'||config.difficulty===1?chordTones:scaleNotes;
    const area = I.region(notes,bar.from,bar.from+4,`第 ${index+1} 小节 · ${bar.from}–${bar.from+4} 品`);
    const next=parsed[(index+1)%parsed.length]?.value;
    const offer=bar.offers.slice(0,4);
    const licks=suitableLicks(bar);
    return `<article class="ss-card"><h3>${area.label} · ${escape(chord.name)}</h3>
      <p>组成音 ${chordTones.map(n=>n.name).join(' · ')}　目标音 ${chordTones.filter(n=>[3,7].includes(S.degree(n.interval))).map(n=>n.name).join(' · ')||'见构成音'}</p>
      ${config.difficulty===0?`<p>指板 ${config.material==='arp'?'当前和弦琶音':escape(chord.root.name+' '+activeScale.zh)}</p>
        <ul>${offer.map(item=>`<li><b>${escape(item.scale.zh)}</b> · ${item.exact?'保留必需和弦音':'作为风格色彩，有音需要解决'} ·
          ${item.fit>.85?'大多与当前调内音重合':'含调外色彩'} · ${escape(item.scale.usage)}</li>`).join('')}</ul>
        ${next&&parsed.length>1?`<p>下一小节 ${escape(next.name)}。试听时可以把三音或七音接到下一和弦的近邻目标音。</p>`:''}`:''}
      ${fretboard(area,chord.root,activeScale,{orientation:'horizontal',labels:config.difficulty===1?'target':'interval',targets,compact:true})}
      <div class="ss-row">${action('improv-arp','试听琶音')}${action('improv-lick','抽一条个人乐句')}</div>
      <p>${licks.length?`匹配乐句 ${licks.slice(0,4).map(item=>escape(item.name)).join(' · ')}`:'可在个人乐句里为这类和弦建立乐句。'}</p>
      ${activeLick?`<p><b>${escape(activeLick.name)}</b> · 用在第 ${index+1} 小节 ${escape(chord.name)}。保留落点，改一次节奏或改一次收尾。 ${action('improv-lick-play','按此调试听')}</p>`:''}</article>`;
  }
  function highlight(index) {
    const line=D.output().querySelector('[data-ss-improv-line]');
    line?.querySelectorAll('[data-ss-action="improv-bar"]').forEach((button,i)=>{
      button.setAttribute('aria-pressed',String(i===index));
    });
    const hint=D.output().querySelector('[data-ss-improv-hint]');
    if(hint)hint.innerHTML=makeHint(parsed[index]);
  }
  D.register('improv',{
    reset(){active=0;activeLick=null;},
    render() {
      const problem=syncBars();
      return `<div class="ss-row">
        ${select('improv-preset','进行预设',presets.map((preset,i)=>option(i,preset.name,config.preset)).join('')+option(-1,'自定义',config.preset))}
        ${select('improv-mode','调式',option('major','大调',config.mode)+option('minor','小调',config.mode))}
        ${select('improv-style','风格',styles.map(style=>option(style,style,config.style)).join(''))}
        ${select('improv-meter','拍号',['4/4','3/4','2/4','6/8'].map(item=>option(item,item,config.meter)).join(''))}
        ${select('improv-difficulty','难度',['初级 · 完整音阶','中级 · 主音与和弦音','进阶 · 当前和弦','实战 · 仅进行']
          .map((item,i)=>option(i,item,config.difficulty)).join(''))}</div>
        <form data-ss-improv-form class="ss-row"><label class="ss-grow">和弦进行<input name="source" value="${escape(config.source)}"></label><button type="submit">应用进行</button></form>
        <div class="ss-row">${select('improv-scale','和弦音阶',option('auto','按上下文建议',config.scale)+scaleOptions(config.scale))}
          ${select('improv-material','显示内容',option('scale','音阶',config.material)+option('arp','琶音',config.material))}
          ${select('improv-position','找把位',option('fixed','固定',config.position)+option('auto','最近位置',config.position))}
          <label>起品<input data-ss="improv-from" type="number" min="0" max="20" value="${config.from}"></label>
          <label>BPM<input data-ss="improv-bpm" type="number" min="35" max="240" value="${config.bpm}"></label>
          <label>Swing<input data-ss="improv-swing" type="range" min="0" max="1" step=".1" value="${config.swing}"></label>
          <label>循环小节<input data-ss="improv-bars" type="number" min="1" max="32" value="${config.bars}"></label></div>
        <div class="ss-row">${[['chords','和弦'],['bass','贝斯'],['metro','节拍器'],['loop','循环']].map(([id,label])=>
          `<label><input data-ss="improv-${id}" type="checkbox" ${config[id]?'checked':''}> ${label}</label>`).join('')}
          ${action('improv-start','开始伴奏')}${action('stop','停止')}</div>
        ${problem?`<p role="status">${problem}</p>`:''}
        <div class="ss-row ss-improv-line" data-ss-improv-line>${parsed.map((bar,i)=>`<button type="button" data-ss-action="improv-bar" data-value="${i}"
           aria-pressed="${config.difficulty!==3&&i===active}">${i+1} · ${escape(bar.value.name)}</button>`).join('')}</div>
        <div data-ss-improv-hint>${makeHint(parsed[active])}</div>`;
    },
    submit(form){if(form.hasAttribute('data-ss-improv-form')){stop();config.source=String(new FormData(form).get('source'));config.preset=-1;active=0;activeLick=null;render();}},
    change(input){
      const name=input.dataset.ss?.replace(/^improv-/,'');
      if(!Object.hasOwn(config,name))return;
      stop();
      if(input.type==='checkbox')config[name]=input.checked;
      else config[name]=['bpm','swing','from','bars','difficulty','preset'].includes(name)?Number(input.value):input.value;
      if(name==='preset'&&config.preset>=0){
        const preset=presets[config.preset];
        config.mode=preset.mode;config.source=preset.source;
        try {config.bars=H.parse(preset.source,root(),preset.mode).length;}catch(_){}
      }
      if(name==='bpm')config.bpm=Math.max(35,Math.min(240,config.bpm||95));
      if(name==='bars')config.bars=totalBars();
      active=0;activeLick=null;render();
    },
    action(name,value) {
      if(name==='improv-bar'){stop();active=Number(value);activeLick=null;highlight(active);return;}
      const bar=parsed[active];
      if(!bar)return;
      if(name==='improv-start'){
        const [beats,unit]=config.meter.split('/').map(Number);
        backing({...config,beats,unit},parsed,(index)=>{
          if(active!==index)activeLick=null;
          active=index;
          if(config.difficulty<3)highlight(index);
          if(config.difficulty<3)status(`第 ${index+1} 小节 · ${parsed[index].value.name}`);
        });
        return;
      }
      if(name==='improv-arp'){play(bar.chord);return;}
      if(name==='improv-lick'){
        const list=suitableLicks(bar);
        if(!list.length)return status('这类和弦目前没有匹配的个人乐句。');
        activeLick=list[Math.floor(Math.random()*list.length)];highlight(active);return;
      }
      if(name==='improv-lick-play'&&activeLick){
        const delta=S.mod(bar.value.root.pc-H.readRoot(activeLick.key).pc+6)-6;
        try{play(I.relocate(I.parseTab(activeLick.tab),delta,bar.from),{bpm:config.bpm});}
        catch(error){status(error.message);}
      }
    },
  });
  window.addEventListener('haitang:scale-progression',event=>{
    const {source,key,mode}=event.detail||{};
    if(typeof source!=='string')return;
    if(H.keys.includes(key))state.key=key;
    config.source=source;
    config.mode=mode==='minor'?'minor':'major';
    config.preset=-1;active=0;activeLick=null;
    try{config.bars=H.parse(source,root(),config.mode).length;}catch(_){}
    D.go('improv');
  });

  const dateKey = date => new Date(date).toLocaleDateString('sv-SE');
  function minutes(ms) {return (ms/60000).toFixed(1)+' 分钟';}
  function stats(records,field) {
    const grouped=new Map();
    records.forEach(record=>{
      const label=record[field];if(label===undefined||label==='')return;
      const item=grouped.get(label)||{count:0,success:0};
      item.count++;item.success+=Number(record.ok);grouped.set(label,item);
    });
    return grouped;
  }
  function statsRows(grouped,keys,format = value=>value) {
    return keys.map(key=>{
      const row=grouped.get(key);
      return `<li>${escape(format(key))} <b>${row?`${row.success}/${row.count} 正确`:'未练习'}</b></li>`;
    }).join('');
  }
  D.register('progress',{
    render() {
      const data=getStore(), history=data.history.filter(item=>item.mode!=='session');
      const due=Object.entries(data.queue).filter(([,item])=>item.mode!=='session').sort((a,b)=>a[1].due-b[1].due);
      const weak=stats(history,'interval'), errors=new Map();
      history.forEach(item=>(Array.isArray(item.errors)?item.errors:[]).forEach(error=>errors.set(error,(errors.get(error)||0)+1)));
      const dates=new Set(data.history.map(item=>dateKey(item.at)));
      const today=new Date(); let streak=0;
      if(!dates.has(dateKey(today)))today.setDate(today.getDate()-1);
      while(dates.has(dateKey(today))){streak++;today.setDate(today.getDate()-1);}
      const daily = Date.now();
      const total=data.history.filter(item=>dateKey(item.at)===dateKey(daily)).reduce((sum,item)=>sum+item.ms,0);
      const correct=history.filter(x=>x.ok).length;
      const latest=history.at(-1);
      const learned=Object.entries(data.progress);
      const counted=prefix=>learned.filter(([key,stage])=>key.startsWith(prefix+':')&&stage>=2).length;
      const label=key=>S.byId.get(key)?.zh||key;
      return `<div class="ss-grid"><article class="ss-card"><h3>今日训练</h3><p>${minutes(total)} · 连续 ${streak} 天</p><p>正确率 ${history.length?Math.round(correct/history.length*100)+'%':'—'} · 答题 ${history.length} 次</p>
        <p>平均答题 ${history.length ? (history.reduce((sum,item)=>sum+item.ms,0)/history.length/1000).toFixed(1)+' 秒':'—'} · 最近 ${latest?new Date(latest.at).toLocaleString():'—'}</p></article>
        <article class="ss-card"><h3>已达到能够演奏</h3><p>音阶 ${counted('scale')} · 琶音 ${counted('arp')} · 乐句 ${counted('lick')}</p><p>个人乐句累计 ${data.licks.length} 条</p>
          <small>学习状态可在图鉴、琶音和乐句卡里设定。</small></article>
        <article class="ss-card"><h3>十二调熟练度</h3><ul>${statsRows(stats(history,'key'),H.keys)}</ul></article>
        <article class="ss-card"><h3>CAGED 区域与薄弱音程</h3><ul>${statsRows(stats(history,'pattern'),['0','1','2','3','4'],v=>'第 '+(+v+1)+' 区域')}</ul>
          <p>音程 ${[...weak.entries()].sort((a,b)=>a[1].success/a[1].count-b[1].success/b[1].count).slice(0,5)
          .map(([key,item])=>`${escape(S.printable(key))} ${item.success}/${item.count}`).join(' · ')||'—'}</p></article>
        <article class="ss-card"><h3>错题与间隔复习</h3><p>${[...errors].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([key,value])=>escape(key)+' ×'+value).join(' · ')||'暂无错题'}</p>
          ${due.slice(0,8).map(([id,item])=>`<p>${escape(item.key+' '+label(item.scale))} · ${new Date(item.due).toLocaleString()}
            ${item.due<=Date.now()?action('progress-review','复习',id):''}</p>`).join('')||'<p>完成一题后会自动安排下次复习。</p>'}</article>
        <article class="ss-card"><h3>自定义学习计划</h3><form data-ss-plan><label>我的计划<textarea name="plan" rows="5" maxlength="5000">${escape(data.plan)}</textarea></label><button type="submit">保存计划</button></form></article>
      </div>
      <article class="ss-card"><h3>颜色和备份</h3><div class="ss-row">${[['root','主音'],['third','三音'],['fifth','五音'],['seventh','七音'],['feature','特征音'],['other','其他']]
        .map(([key,name])=>`<label>${name}<input type="color" data-ss-color="${key}" value="${data.palette[key]}"></label>`).join('')}</div>
        <div class="ss-row">${action('progress-export','导出 JSON 备份')}<label>导入 JSON 备份<input data-ss="progress-import" type="file" accept=".json,application/json"></label></div>
        <p>记录保存在当前浏览器。导入备份会替换本机的这套记录。</p></article>`;
    },
    async change(input){
      if(input.dataset.ssColor){
        getStore().palette[input.dataset.ssColor]=input.value;updatePalette();persist();return;
      }
      if(input.dataset.ss==='progress-import'&&input.files[0]){
        try{
          const file=input.files[0];if(file.size>6000000)throw Error('备份文件超过 6 MB。');
          const source=JSON.parse(await file.text());
          if(!window.confirm('用这份备份替换本机的吉他学习记录和个人乐句？'))return;
          replaceStore(source);render();status('备份已导入。');
        }catch(error){status(error.message);}
        finally{input.value='';}
      }
    },
    submit(form){if(form.hasAttribute('data-ss-plan')){getStore().plan=String(new FormData(form).get('plan')).slice(0,5000);persist();status('学习计划已保存。');}},
    action(name,value){
      if(name==='progress-review')openReview(getStore().queue[value]);
      if(name==='progress-export'){
        const blob=new Blob([JSON.stringify(getStore(),null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='haitang-guitar-study.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        status('已导出学习记录和乐句。');
      }
    },
  });
})();
