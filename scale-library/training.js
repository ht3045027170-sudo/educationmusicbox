(() => {
  'use strict';
  const studio = window.HetianScaleStudio;
  if (!studio) return;
  const {H,S,I,state,root,scale,currentNotes,escape,option,action,select,scaleOptions,rootOptions,chordOptions,
    fretboard,progressLevel,collectionPositions,zoom,play,stop,render,saveRecord,getStore,status} = studio;

  let compare = { scales:['dorian','harmonic-minor'], third:false, mode:'parallel' };
  function compareRoot(base, meta, first) {
    if (first || compare.mode === 'parallel') return base;
    // In relative mode the top key is the common parent; each diatonic mode starts on its own scale degree.
    const mode = S.relative(meta)?.mode;
    return mode === undefined ? base : H.readRoot(H.spell(base,String(mode+1)));
  }
  function compareRows() {
    return [state.scale,...compare.scales.slice(0,compare.third?2:1)].map((id,index)=>{
      const meta=S.byId.get(id);
      const tonic=compareRoot(root(),meta,compare.mode==='parallel');
      return {meta,tonic,notes:S.tones(tonic,meta)};
    });
  }
  function contextChord(tonic, meta) {
    const id = meta.chords.find(id=>H.types.has(id));
    return id === undefined ? [48+tonic.pc] : I.material(tonic,H.types.get(id)).map(n=>48+tonic.pc+n.pitch);
  }
  studio.register('compare',{
    render() {
      const rows=compareRows();
      const shared = new Set(rows[0].notes.filter(n=>rows.every(row=>row.notes.some(tone=>tone.pc===n.pc))).map(n=>n.pc));
      return `<div class="ss-row">${select('compare-mode','对比方式',option('parallel','相同主音',compare.mode)+
        option('relative','相同关系大调 · 上方调性是母调',compare.mode))}
        ${select('compare-second','第二种音阶',scaleOptions(compare.scales[0]))}
        ${compare.third?select('compare-third','第三种音阶',scaleOptions(compare.scales[1])):''}
        ${action('compare-count',compare.third?'比较两种':'比较三种')}</div>
        <p class="ss-card">共同音 ${rows[0].notes.filter(n=>shared.has(n.pc)).map(n=>n.name).join(' · ')||'无'}。
        ${compare.mode==='relative'?'可从大调推导的调式按同一母调重设主音；其他音阶沿用上方调性。':''}</p>
        <div class="ss-grid">${rows.map(({meta,tonic,notes},i)=>`<article class="ss-card">
          <h3>${escape(tonic.name+' '+meta.zh)}</h3>
          <p>${notes.map(n=>`<button type="button" data-ss-action="contrast-note" data-value="${i}:${n.pitch}"
            class="${shared.has(n.pc)?'ss-common':'ss-difference'}" aria-label="试听 ${n.name} ${shared.has(n.pc)?'共同音':'差异音'}">${n.name}${n.featured?' ★':''}</button>`).join(' ')}</p>
          <div class="ss-row">${action('contrast-play','试听音阶',i)}${action('contrast-chord','叠和弦试听',i)}</div>
          ${fretboard(I.region(notes,Math.max(0,Math.min(20,state.from)),Math.min(24,Math.max(0,Math.min(20,state.from))+4),'对比把位'),
            tonic,meta,{labels:'interval',common:shared})}
          <small>描边为共同音，★ 为特征音。并列指板使用相同品位。</small>
        </article>`).join('')}</div>`;
    },
    change(input) {
      if(input.dataset.ss==='compare-mode') compare.mode=input.value;
      if(input.dataset.ss==='compare-second') compare.scales[0]=input.value;
      if(input.dataset.ss==='compare-third') compare.scales[1]=input.value;
      stop(); render();
    },
    action(name,value) {
      if(name==='compare-count'){compare.third=!compare.third;render();return;}
      const [index,pitch]=value.split(':').map(Number);
      const {meta,tonic,notes}=compareRows()[index]||{};
      if(!meta)return;
      if(name==='contrast-note') play([{midi:60+tonic.pc+pitch,beats:1}]);
      if(name==='contrast-play'||name==='contrast-chord') play(I.sequence(tonic,notes),
        {chord:name==='contrast-chord'?contextChord(tonic,meta):[]});
    },
  });

  const arp = {type:'maj7',layout:'caged',from:5,to:9,string:6,order:'up',progression:'Dm7 G7 Cmaj7'};
  const arpRows = () => {
    const notes=I.material(root(),H.types.get(arp.type));
    if (arp.layout==='single') return [I.region(notes,0,24,arp.string+' 弦',[arp.string])];
    if (arp.layout==='custom') return [I.region(notes,arp.from,arp.to,'多弦自定义把位')];
    const anchored = I.caged(root(),notes);
    const list = anchored.length ? anchored : [I.region(notes,arp.from,arp.to,'琶音把位')];
    if(arp.layout==='cross') return list.map((item,i)=>i===list.length-1?item:{...item,route:I.crossRoute(item,list[i+1])});
    return list;
  };
  const arpOrder = [['up','顺序'],['down','逆序'],['3','三音开始'],['5','五音开始'],['7','七音开始'],['random','随机音序']];
  studio.register('arp',{
    render() {
      const notes=I.material(root(),H.types.get(arp.type));
      return `<div class="ss-row">${select('arp-type','和弦琶音',chordOptions(arp.type))}
        ${select('arp-layout','指板', [['caged','CAGED 五区域'],['single','单弦'],['custom','多弦把位'],['cross','跨把位']]
          .map(([id,label])=>option(id,label,arp.layout)).join(''))}
        ${select('arp-order','音序',arpOrder.map(([id,label])=>option(id,label,arp.order)).join(''))}
        ${arp.layout==='single'?select('arp-string','琴弦',[6,5,4,3,2,1].map(i=>option(i,i+' 弦',arp.string)).join('')):''}
        ${arp.layout==='custom'?`<label>起品<input data-ss="arp-from" type="number" min="0" max="24" value="${arp.from}"></label><label>止品<input data-ss="arp-to" type="number" min="0" max="24" value="${arp.to}"></label>`:''}
        ${action('arp-play','试听音序')}${progressLevel('arp:'+arp.type)}</div>
        <p class="ss-card">${escape(root().name+H.suffixLabel(arp.type))} · ${notes.map(n=>n.name+' '+S.printable(n.interval)).join('　')}
        ${arp.type==='7alt'?' · 采用 1 3 ♭5 ♭7 ♯9 这个变化组合':''}</p>
        <div class="ss-grid ${state.single?'single':''}">${arpRows().map((item,i)=>`<article class="ss-card"><h4>${item.label}</h4>
          ${fretboard(item,root(),null,{labels:'interval'})}
          <div class="ss-row">${action('arp-zoom','放大',i)}${action('arp-shape','试听指型',i)}
            ${item.route?.length?action('route','试听连接',item.route.map(n=>n.midi).join(',')):''}</div></article>`).join('')}</div>
        <article class="ss-card"><h3>相邻和弦最近目标音</h3><label>和弦进行<input data-ss="arp-progression" value="${escape(arp.progression)}"></label>
          <div class="ss-row"><label>起品<input data-ss="arp-from" type="number" min="0" max="24" value="${arp.from}"></label>
          <label>止品<input data-ss="arp-to" type="number" min="0" max="24" value="${arp.to}"></label>${action('arp-connect','计算并试听')}</div>
          <p data-ss-connect role="status"></p></article>`;
    },
    change(input) {
      const field=input.dataset.ss?.replace(/^arp-/,'');
      if(!Object.hasOwn(arp,field))return;
      arp[field]=input.type==='number'||field==='string'?Number(input.value):input.value;
      if(field!=='progression'){stop();render();}
    },
    action(name,value) {
      if(name==='arp-zoom'||name==='arp-shape'){
        const region=arpRows()[Number(value)];
        if(name==='arp-zoom')return zoom(region,root(),null,{labels:'interval'});
        play(region.cells.filter(n=>n.tone).sort((a,b)=>a.midi-b.midi));return;
      }
      if(name==='arp-play'){
        const notes=I.material(root(),H.types.get(arp.type));
        let pitches=notes.map(t=>48+root().pc+t.pitch);
        if(arp.order==='down') pitches.reverse();
        else if(arp.order==='random') pitches=shuffle(pitches);
        else if(arp.order!=='up'){
          const start=notes.findIndex(n=>S.degree(n.interval)===Number(arp.order));
          if(start<0)return status('这个和弦没有所选度数。');
          pitches=[...pitches.slice(start),...pitches.slice(0,start).map(n=>n+12)];
        }
        play(pitches);return;
      }
      if(name==='arp-connect'){
        const out=studio.output().querySelector('[data-ss-connect]');
        try{
          let previous;
          const line=H.parse(arp.progression,root()).map(item=>{
            const chord=H.resolve(item,root(),'major');
            const cell=I.nearestTargets(previous,chord,arp.from,arp.to);
            if(cell)previous=cell.midi;
            return {chord,cell};
          });
          out.textContent=line.map(({chord,cell})=>`${chord.name} ${cell?`${cell.tone.name}（${cell.string} 弦 ${cell.fret} 品）`:'本把位没有目标音'}`).join(' → ');
          play(line.map(({cell})=>cell||{rest:true,beats:.5}));
        }catch(error){out.textContent=error.message;}
      }
    },
  });

  function shuffle(items) {
    const copy=items.slice();
    for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
    return copy;
  }
  const modes = [['write','指板音阶默写'],['root','主音寻找'],['interval','音程寻找'],['caged','指型默写'],
    ['transpose','随机移调'],['feature','特征音训练'],['arpeggio','琶音默写'],['match','和弦音阶匹配'],
    ['ear','音阶听辨'],['lick','乐句记忆']];
  let quizMode='write', question=null, picks=new Set(), result='', reveal=false, scopeQuestion=null;
  const memorized = () => I.region([],0,12,'0–12 品');
  function newQuestion(due = null) {
    const mode = due?.mode || quizMode;
    if(!modes.some(([id])=>id===mode))return;
    quizMode=mode;
    const tonic = H.readRoot(due?.key || (['root','interval','transpose'].includes(mode)?shuffle(H.keys)[0]:state.key));
    const meta = S.byId.get(due?.scale) || (mode==='ear'?shuffle(['major','minor','dorian','mixolydian','harmonic-minor','minor-pent'].map(id=>S.byId.get(id)))[0]:scale());
    const tones=S.tones(tonic,meta);
    const area = mode==='caged' ? I.caged(tonic,tones)[Number(due?.pattern)||Math.floor(Math.random()*5)]
      : memorized();
    const interval = due?.interval || (mode==='feature' ? (shuffle(meta.feature)[0]||'1') : mode==='interval' ?
      shuffle(['b2','2','b3','3','4','#4','5','b6','6','b7','7'])[0] : '1');
    const ids = ['maj7','m7','7','m7b5','dim7','m(maj7)','6','m6','maj9'];
    const chordId=ids.includes(due?.chord) ? due.chord : shuffle(ids)[0], type=H.types.get(chordId);
    const chord={root:tonic,type};
    const lick=getStore().licks.find(item=>item.id===due?.lick) || shuffle(getStore().licks)[0];
    let answer=[];
    if(mode==='root')answer=area.cells.filter(cell=>S.mod(cell.midi)===tonic.pc).map(I.key);
    if(mode==='interval'||mode==='feature')answer=area.cells.filter(cell=>S.mod(cell.midi-tonic.pc)===S.mod(H.semitones(interval))).map(I.key);
    if(mode==='caged')answer=area.cells.filter(cell=>cell.tone).map(I.key);
    if(['write','transpose'].includes(mode))answer=area.cells.filter(cell=>tones.some(note=>note.pc===S.mod(cell.midi))).map(I.key);
    if(mode==='arpeggio')answer=I.material(tonic,type).map(note=>note.name);
    if(mode==='lick'&&lick)answer=I.parseTab(lick.tab).filter(note=>!note.rest).map(I.key);
    const candidates=I.compatible(chord,tonic,'major').filter(entry=>entry.exact);
    let choices=[];
    if(mode==='match'){
      const known=candidates.filter(entry=>entry.explicit).slice(0,2);
      const fallback=known.length?known:candidates.slice(0,2);
      answer=fallback.map(entry=>entry.scale.id);
      choices=shuffle([...fallback.map(entry=>entry.scale),...shuffle(S.collection.filter(s=>!candidates.some(n=>n.scale.id===s.id))).slice(0,4)]);
    }
    if(mode==='ear'){
      answer=[meta.id];
      choices=shuffle([meta,...shuffle(S.collection.filter(s=>s.id!==meta.id&&s.pitches.join()!==meta.pitches.join())).slice(0,3)]);
    }
    const pattern=mode==='caged'?String(I.caged(tonic,tones).findIndex(item=>item.label===area.label)):'';
    question={mode,tonic,meta,tones,area,interval,answer,chordId,type,lick,choices,pattern,started:Date.now()};
    picks=new Set();result='';reveal=false;
  }
  function prompt(q) {
    const {mode,tonic,meta,interval,type,lick,area}=q;
    const name=tonic.name+' '+meta.zh;
    const prompts={
      write:`在 0–12 品选出 ${name} 的全部位置。`,root:`找出 0–12 品上所有 ${tonic.name}。`,
      interval:`找出相对于 ${tonic.name} 的 ${S.printable(interval)}。`,caged:`默写 ${name} 的 ${area.label}。`,
      transpose:`随机调性是 ${tonic.name}，默写 ${meta.zh}。`,feature:`找出 ${name} 的特征音 ${S.printable(interval)}。`,
      arpeggio:`填写 ${tonic.name+H.suffixLabel(type.id)} 的实际构成音，用空格分开。`,
      match:`选择所有能保留 ${tonic.name+H.suffixLabel(type.id)} 所需构成音的选项。`,
      ear:`试听后选择音阶类型。主音是 ${tonic.name}。`,
      lick:lick?`试听并复现 ${lick.name} 的弦与品位顺序。`:'先在个人乐句保存至少一条乐句。',
    };
    return prompts[mode];
  }
  function grade(entered) {
    if(!question||reveal)return;
    const q=question;
    let given=q.mode==='arpeggio'?(entered||'').trim().split(/[\s,，]+/).map(raw=>H.readRoot(raw)?.name||raw)
      : q.mode==='lick'?(entered||'').trim().split(/\s+/).filter(Boolean) : [...picks];
    if(q.mode!=='lick')given=[...new Set(given)];
    const missing=q.answer.filter((answer,i)=>q.mode==='lick'?given[i]!==answer:!given.includes(answer));
    const extra=given.filter(key=>!q.answer.includes(key));
    const ok=given.length===q.answer.length&&!missing.length&&!extra.length;
    saveRecord([q.mode,q.tonic.name,q.meta.id,q.pattern,q.interval,q.chordId,q.lick?.id||''].join('/'),ok,
      Date.now()-q.started,{mode:q.mode,key:q.tonic.name,scale:q.meta.id,pattern:q.pattern,interval:q.interval,
        chord:q.chordId,lick:q.lick?.id||'',errors:[...missing.map(item=>'漏 '+item),...extra.map(item=>'多 '+item)].slice(0,30)});
    reveal=true;
    result=ok?'正确。':`漏选或顺序错误 ${missing.length} 个，多选 ${extra.length} 个。`;
    render();
  }
  studio.register('memory',{
    reset(){question=null;},
    render() {
      if(scopeQuestion){newQuestion(scopeQuestion);scopeQuestion=null;}
      if(!question)newQuestion();
      const q=question;
      const needsText=q.mode==='arpeggio'||q.mode==='lick';
      const choices=q.choices.length>0;
      const area={...q.area,cells:q.area.cells.map(cell=>({...cell,tone:q.answer.includes(I.key(cell))
        ?q.tones.find(tone=>tone.pc===S.mod(cell.midi))||{name:I.noteName(cell.midi),interval:'1'}:undefined}))};
      return `<div class="ss-row">${select('quiz-mode','题型',modes.map(([id,label])=>option(id,label,quizMode)).join(''))}
        ${action('new-question','换一题')}${['ear','lick'].includes(q.mode)?action('quiz-listen','试听题目'):''}
        ${action('review-next','复习到期题')}</div>
        <article class="ss-card"><h3>${escape(prompt(q))}</h3>
        ${q.mode==='lick'&&!q.lick?'':needsText?`<form data-ss-answer><label>答案<input name="answer" autocomplete="off" placeholder="${q.mode==='lick'?'如 3:7 2:6 2:8':'如 C E G B'}" ${reveal?'disabled':''}></label><button ${reveal?'disabled':''}>交卷</button></form>`
        :choices?`<div class="ss-row">${q.choices.map(o=>`<button type="button" data-ss-action="quiz-pick" data-value="${o.id}"
          aria-pressed="${picks.has(o.id)}" ${reveal?'disabled':''}>${escape(o.zh)}</button>`).join('')}</div>`
        :fretboard(area,q.tonic,q.meta,{labels:reveal?'name':'hide',quiz:true,reveal,picks,kind:'quiz-pick'})}
        <div class="ss-row">${!needsText&&!reveal?action('quiz-grade','交卷'):''}${!reveal?action('quiz-clear','清空'):''}</div>
        ${reveal?`<p role="status">${escape(result)} ${needsText||choices?'正确答案 '+escape(q.answer.map(id=>S.byId.get(id)?.zh||id).join(' · ')):''}</p>`:''}</article>`;
    },
    change(input){if(input.dataset.ss==='quiz-mode'){quizMode=input.value;newQuestion();render();}},
    submit(form){if(form.hasAttribute('data-ss-answer'))grade(new FormData(form).get('answer'));},
    action(name,value,target){
      switch(name){
      case 'new-question':newQuestion();render();break;
      case 'quiz-pick':if(!reveal){if(picks.has(value))picks.delete(value);else picks.add(value);
        target.classList.toggle('pick',picks.has(value));target.setAttribute('aria-pressed',String(picks.has(value)));}break;
      case 'quiz-clear':picks.clear();render();break;
      case 'quiz-grade':grade();break;
      case 'quiz-listen': if(question.mode==='ear')play(I.sequence(question.tonic,question.tones));
        else if(question.lick)play(I.parseTab(question.lick.tab),{bpm:Number(question.lick.bpm)});break;
      case 'review-next': {
        const due=Object.values(getStore().queue).filter(item=>item.due<=Date.now()&&modes.some(([id])=>id===item.mode)).sort((a,b)=>a.due-b.due)[0];
        if(!due)return status('目前没有到期的题目。');
        newQuestion(due);render();break;
      }
      }
    },
  });
  studio.openReview = item => {scopeQuestion=item;studio.go('memory');};
})();
