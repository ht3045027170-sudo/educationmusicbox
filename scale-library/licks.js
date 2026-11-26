(() => {
  'use strict';
  const D=window.HetianScaleStudio;
  if(!D)return;
  const {S,H,I,state,getStore,persist,escape,option,action,select,rootOptions,progressLevel,play,stop,status,render}=D;
  const categories=['Blues','Blues Rock','Jazz','Bebop','Pop','Funk','Neo Soul','Bossa Nova','Rock','大调251','小调251',
    '属七和弦','半音趋近音','包围音','目标音乐句','终止乐句'];
  const source = [
    ['蓝音回到主音','Blues','A','m7','小调 Blues','i7','4:7@0.5 3:5@0.5 3:7/(8)@0.5 3:7@0.5 3:5@0.5 4:7~@1.5'],
    ['第三音包围','Jazz','C','maj7','自然大调','Imaj7','3:10@0.5 4:13@0.5 4:14@1 3:12@0.5 2:12@0.5 1:8@1'],
    ['末拍问答','Funk','E','7','属七五声音阶','I7','3:9@0.5 r@0.5 2:9@0.5 3:7@0.5 3:9@0.5 r@0.5 2:9@0.5 3:9@0.5'],
    ['小调落在三音','Neo Soul','A','m7','自然小调','i7','3:5h(7)@1 2:5@0.5 2:8p(5)@1 3:5~@1.5'],
    ['副歌开头','Pop','G','maj7','大调五声','Imaj7','4:5@0.5 3:4@0.5 3:7@0.5 2:5@0.5 3:7@0.5 3:4@0.5 4:5@1'],
  ].map(([name,category,key,chord,scale,degree,tab],i)=>({id:'lesson-'+i,number:'HT'+(i+1),name,category,key,chord,scale,
    degree,tab,bpm:90,source:'海棠原创教学',difficulty:'入门',scene:'上句问、下句答',
    tricks:'',memo:'',url:'',favorite:false}));
  const empty=()=>({id:'',number:'',name:'',category:'Blues',key:state.key,chord:'',scale:'',degree:'',tab:'',bpm:90,
    source:'',difficulty:'入门',scene:'',tricks:'',memo:'',url:'',favorite:false});
  let selection='', draft=empty(), search='', only=false;
  let targetKey=state.key, position=5, octave=0, speed=1, loop=false, metro=false, transformed=null;
  function reset() { targetKey=draft.key;position=5;octave=0;transformed=null; }
  function selectLick(id) {
    const record=[...getStore().licks,...source].find(item=>item.id===id);
    if(!record)return;
    selection=id;
    draft={...record};
    if(id.startsWith('lesson-')) draft.id='';
    reset();
  }
  function urlField(value) {
    if(!value)return '';
    try { const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''; } catch(_){return '';}
  }
  const field=(name,label)=>`<label>${label}<input name="${name}" maxlength="180" value="${escape(draft[name])}"></label>`;
  function tabGraphic(notes) {
    if(!notes.length)return '';
    return `<div class="ss-tab-frame"><table class="ss-tab" aria-label="六线谱"><thead><tr><th>弦</th>${
      notes.map((n,i)=>`<th title="时值 ${n.beats} 四分音符拍">${i+1}</th>`).join('')}</tr></thead><tbody>${
      [1,2,3,4,5,6].map(string=>`<tr><th>${string}</th>${notes.map(n=>`<td>${n.rest?(string===1?'休':'─'):
      n.string===string?escape(n.fret+n.technique+(n.targetFret===null?'':n.targetFret)):'─'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function setDraftFromForm(form) {
    const values=Object.fromEntries(new FormData(form));
    for(const key of Object.keys(empty())) {
      if(key==='id'||key==='favorite'||!(key in values))continue;
      draft[key]=key==='bpm'?Number(values[key]):String(values[key]).trim();
    }
  }
  function getNotes() {
    const original=I.parseTab(draft.tab);
    const from=H.readRoot(draft.key), to=H.readRoot(targetKey);
    const shift = S.mod(to.pc-from.pc+6)-6;
    return I.relocate(original,shift,position,octave);
  }
  D.register('licks',{
    render() {
      const mine=getStore().licks;
      const visible=mine.filter(lick=>(!only||lick.favorite)&&
        `${lick.name} ${lick.category} ${lick.key} ${lick.number} ${lick.source}`.toLowerCase().includes(search.toLowerCase()));
      let notes=[];
      try {notes=transformed||I.parseTab(draft.tab);}catch(_){}
      const link=urlField(draft.url);
      return `<div class="ss-row"><label>搜索乐句<input data-ss="lick-search" value="${escape(search)}"></label>
        ${action('lick-only',only?'显示全部':'只看收藏')}${action('lick-new','新建乐句')}</div>
        <div class="ss-grid">${visible.map(item=>`<article class="ss-card"><h3>${escape(item.name)}</h3><p>${escape(item.number+' · '+item.key+' · '+item.category)}</p>
          ${action('lick-select','打开',item.id)} ${action('lick-favorite',item.favorite?'取消收藏':'收藏',item.id)}
          ${progressLevel('lick:'+item.id)}</article>`).join('')||'<p>暂无符合条件的个人乐句。</p>'}</div>
        <details class="ss-card"><summary>载入原创教学乐句</summary><div class="ss-row">${source.map(item=>action('lick-select',item.name,item.id)).join('')}</div></details>
        <article class="ss-card"><h3>六线谱编辑</h3>
        <form data-ss-lick-form><div class="ss-form-grid">${field('name','乐句名称')}${field('number','编号')}${field('source','来源歌曲或音乐家')}
          <label>原始调性<select name="key">${rootOptions(draft.key)}</select></label>
          <label>分类<select name="category">${categories.map(item=>option(item,item,draft.category)).join('')}</select></label>
          ${field('chord','适用和弦（写 7、m7 或 G7 等）')}${field('scale','适用音阶')}${field('degree','功能级数')}
          <label>BPM<input name="bpm" type="number" min="35" max="240" value="${Number(draft.bpm)||90}"></label>
          ${field('tricks','技巧')}${field('difficulty','难度')}${field('scene','使用场景')}${field('url','原始音视频链接')}
          <label>备注<textarea name="memo" maxlength="1500">${escape(draft.memo)}</textarea></label></div>
          <label>六线谱音符<textarea name="tab" maxlength="5000" rows="4" spellcheck="false" placeholder="3:5h(7)@1 2:5@0.5 r@0.5">${escape(draft.tab)}</textarea></label>
          <p>格式：弦:品@拍数，默认半拍。r 是休止。h 击弦、p 勾弦、/ 上滑、反斜杠下滑、b 推弦、~ 揉弦。例：3:5h(7)@1。</p>
          <div class="ss-row"><button type="submit">保存乐句</button>${action('lick-draw','刷新谱面')}${draft.id?action('lick-delete','删除乐句',draft.id):''}
            ${link?`<a href="${escape(link)}" target="_blank" rel="noopener noreferrer">打开音视频</a>`:''}</div></form>
          <div data-ss-lick-graphic>${tabGraphic(notes)}</div>
          ${transformed?`<p>已转换 ${escape(targetKey)}${octave?` · 明确${octave>0?'升':'降'}一八度`:' · 同一目标音区'}</p>`:''}
        <div class="ss-row">${select('lick-target','移调到',rootOptions(targetKey))}
          <label>目标把位<input data-ss="lick-position" type="number" min="0" max="24" value="${position}"></label>
          ${select('lick-octave','八度',option(-1,'降一八度',octave)+option(0,'保留目标音区',octave)+option(1,'升一八度',octave))}
          ${select('lick-speed','速度',option(1,'原速',speed)+option(.75,'75%',speed)+option(.5,'50%',speed))}
          <label><input type="checkbox" data-ss="lick-loop" ${loop?'checked':''}> 循环</label>
          <label><input type="checkbox" data-ss="lick-metro" ${metro?'checked':''}> 节拍器</label>
          ${action('lick-shift','移调 / 换把')}${action('lick-play','播放当前谱面')}${transformed?action('lick-use-shift','将转换结果填入编辑器'):''}</div>
          <small>谱面保留技巧及目标品。试听以独立发音示意目标，推弦与揉弦的连续音高变化需用琴练习。</small></article>`;
    },
    change(input) {
      const form=input.closest('[data-ss-lick-form]');
      if(form){setDraftFromForm(form);transformed=null;return;}
      const field=input.dataset.ss;
      if(field==='lick-search'){search=input.value;render();}
      if(field==='lick-target'){targetKey=input.value;transformed=null;}
      if(field==='lick-position'){position=I.clamp(input.value);transformed=null;}
      if(field==='lick-octave'){octave=Number(input.value);transformed=null;}
      if(field==='lick-speed')speed=Number(input.value);
      if(field==='lick-loop')loop=input.checked;
      if(field==='lick-metro')metro=input.checked;
    },
    submit(form) {
      if(!form.hasAttribute('data-ss-lick-form'))return;
      setDraftFromForm(form);
      try{
        if(!draft.name)throw Error('请填写乐句名称。');
        if(draft.bpm<35||draft.bpm>240||!draft.bpm)throw Error('BPM 允许 35–240。');
        if(!I.parseTab(draft.tab).length)throw Error('至少需要一个音或休止。');
        if(draft.url&&!urlField(draft.url))throw Error('音视频链接需为 http 或 https。');
        if(!draft.id)draft.id=globalThis.crypto?.randomUUID?.()||String(Date.now());
        const existing=getStore().licks.findIndex(item=>item.id===draft.id);
        if(existing<0)getStore().licks.unshift({...draft}); else getStore().licks[existing]={...draft};
        selection=draft.id;persist();render();status('已保存 '+draft.name);
      }catch(error){status(error.message);}
    },
    action(name,value,target) {
      if(name==='lick-select'){stop();selectLick(value);render();return;}
      if(name==='lick-new'){stop();selection='';draft=empty();reset();render();return;}
      if(name==='lick-only'){only=!only;render();return;}
      const found=getStore().licks.find(item=>item.id===value);
      if(name==='lick-favorite'&&found){found.favorite=!found.favorite;if(selection===value)draft.favorite=found.favorite;persist();render();return;}
      if(name==='lick-delete'&&found){
        if(!window.confirm(`删除「${found.name}」？`))return;
        getStore().licks=getStore().licks.filter(item=>item.id!==value);
        delete getStore().progress['lick:'+value];
        selection='';draft=empty();reset();persist();render();status('乐句已删除');return;
      }
      const form=target.closest('article')?.querySelector('[data-ss-lick-form]') || D.output().querySelector('[data-ss-lick-form]');
      if(form)setDraftFromForm(form);
      try {
        if(name==='lick-draw'){transformed=null;I.parseTab(draft.tab);render();}
        if(name==='lick-shift'){transformed=getNotes();render();}
        if(name==='lick-play')play(transformed||I.parseTab(draft.tab),{bpm:Number(draft.bpm)*speed,loop,metro});
        if(name==='lick-use-shift'&&transformed){
          draft.tab=I.formatTab(transformed);draft.key=targetKey;octave=0;transformed=null;render();
          status('转换结果已填入编辑器，可以保存为当前乐句。');
        }
      }catch(error){status(error.message);}
    },
  });
})();
