// Convert only explicit, bounded musical notation. Never execute prose as a script.
const pitch=value=>{const match=String(value).match(/^([A-G])([#b]?)([0-8])$/);if(!match)return null;const midi=(Number(match[3])+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1]]+(match[2]==='#'?1:match[2]==='b'?-1:0);return midi>=21&&midi<=108?midi:null};
const note=(value,dur=1,extra={})=>({midi:pitch(value),name:value,dur,...extra});
export function prepareQuestionMusic(content,subject='theory') {
  if(content.musicData) {
    const data=content.musicData;content={...content,notes:Array.isArray(content.notes)?content.notes:data.notes,bpm:content.bpm ?? data.tempo ?? data.bpm,meter:content.meter ?? data.meter,keySignature:content.keySignature ?? data.keySignature,clef:content.clef ?? data.clef,category:content.category ?? data.category};
  }
  if(Array.isArray(content.notes) && (content.audioSettings?.playMode==='harmonic'||content.musicType==='chord'||content.category==='chord'))content={...content,notes:content.notes.map(n=>({...n,simultaneous:true}))};
  if(subject!=='dictation'&&!content.audioScript&&!content.notes)return {content};
  if(Array.isArray(content.notes)&&content.notes.length) {
    if(content.notes.length>256||content.notes.some(n=>!n||(!n.rest&&(!Number.isInteger(n.midi)||n.midi<21||n.midi>108))||!Number.isFinite(n.dur)||n.dur<=0||n.dur>16))return {error:'音符数据无效，请在音乐编辑器中修正。'};
    const bpm=Number(content.bpm ?? 100), settings=content.audioSettings||{};
    if(!Number.isFinite(bpm)||bpm<20||bpm>240||(settings.playCount!==undefined&&(!Number.isInteger(settings.playCount)||settings.playCount<1||settings.playCount>4))||(settings.gapBeats!==undefined&&(!Number.isFinite(settings.gapBeats)||settings.gapBeats<0||settings.gapBeats>32)))return {error:'播放速度或重复设置无效，请在编辑器中修正。'};
    return {content:{...content,notes:content.notes.map(n=>({...n})),bpm,listenOnly:subject==='dictation'}};
  }
  const script=String(content.audioScript||'').trim();if(!script)return {error:'听写题缺少可播放音符，请使用音乐编辑器补齐。'};
  if(script.length>3000)return {error:'播放说明过长，请改用音乐编辑器。'};
  const prompt=String(content.prompt||content.question||''),meter=(prompt.match(/\b([2346]\/([48]))\b/)||script.match(/\b([2346]\/([48]))\b/))?.[1]||'4/4';
  const [top,bottom]=meter.split('/').map(Number),barBeats=top*4/bottom;
  let notes=[],category='single',bpm=Number(script.match(/♩\s*=\s*(\d+)/)?.[1])||60,prelude=[],countInBeats=0;
  const explicitPitchList=value=>{
    const tokens=value.trim().split(/[-与\s]+/).filter(Boolean);if(!tokens.length||tokens.length>64||tokens.some(token=>pitch(token)===null))return null;
    return tokens;
  };
  let match;
  if((match=script.match(/^钢琴等力度弹奏：([^。]+)。/))) {
    const pitches=explicitPitchList(match[1]);if(!pitches)return {error:'音高说明无法准确读取，请使用音乐编辑器。'};notes=pitches.map(value=>note(value));if(script.includes('先给A4标准音'))prelude=[note('A4')];
  }else if((match=script.match(/^钢琴同时弹奏([^，]+)，每次保持(\d+(?:\.\d+)?)秒/))) {
    const pitches=explicitPitchList(match[1]);if(!pitches||pitches.length<2)return {error:'和声说明无法准确读取，请使用音乐编辑器。'};
    notes=pitches.map(value=>note(value,Number(match[2]),{simultaneous:true}));category=pitches.length===2?'harmonic_interval':'chord';
  }else if((match=script.match(/^钢琴先弹([A-G][#b]?[0-8])，后弹([A-G][#b]?[0-8])，[^，]+，间隔约(\d+(?:\.\d+)?)秒/))) {
    if(pitch(match[1])===null||pitch(match[2])===null)return {error:'音程说明超出支持范围。'};notes=[note(match[1],Number(match[3])),note(match[2],Number(match[3]))];category='melodic_interval';
  }else if((match=script.match(/(?:每小节音高脚本|旋律)：([^。]+)。/))) {
    const bars=match[1].split(/[｜|]/);category='melody';
    for(const bar of bars){
      const tokens=bar.split('-').filter(Boolean);if(!tokens.length||tokens.some(token=>pitch(token)===null))return {error:'旋律说明无法准确读取，请使用音乐编辑器。'};
      const unit=meter==='6/8'?.5:1;let values=tokens.map(value=>note(value,unit));
      const used=values.reduce((sum,n)=>sum+n.dur,0);
      if(/-$/.test(bar)&&used<barBeats)values[values.length-1].dur+=barBeats-used;
      if(Math.abs(values.reduce((sum,n)=>sum+n.dur,0)-barBeats)>.001)return {error:`旋律小节时值与${meter}不一致，请校对。`};
      notes.push(...values);
    }
    const key=(script.match(/(?:先弹)?([CDEFGABa-g])(?:大调|小调)/)||[])[1];
    const tonics={C:60,G:67,F:65,a:69,e:64,d:62};
    if(script.includes('先弹')&&tonics[key]!==undefined){const root=tonics[key],minor=key===key.toLowerCase();prelude=[{midi:root,dur:1,simultaneous:true},{midi:root+(minor?3:4),dur:1,simultaneous:true},{midi:root+7,dur:1,simultaneous:true}, {...notes[0],dur:1,simultaneous:false}];}
  }else if((match=script.match(/(?:逐小节节奏读法|击读)：([^；。]+)[；。]/))) {
    category='rhythm';bpm=meter==='6/8'&&script.includes('附点四分音符=60')?90:bpm;countInBeats=barBeats;
    const patterns={'ta':[1],'ti-ti':[.5,.5],'tika-tika':[.25,.25,.25,.25],'休-ti':[-.5,.5],'taa-ti':[1.5,.5],'tim-ka':[.75,.25],'ti-tika':[.5,.25,.25],'ti-ti-ti':[.5,.5,.5],'taa':[meter==='6/8'?1.5:2]};
    const bars=script.includes('逐小节')?match[1].split(/[｜|]/):[match[1].replace(/[｜|]/g,' ')];
    for(const bar of bars){const values=[];for(const token of bar.trim().split(/\s+/)){if(!patterns[token])return {error:'节奏说明存在不明确符号，请使用音乐编辑器。'};values.push(...patterns[token].map(dur=>({midi:76,dur:Math.abs(dur),rest:dur<0})))}
      const used=values.reduce((sum,n)=>sum+n.dur,0);if(Math.abs(used-barBeats)>.001)return {error:`节奏脚本为${used}拍，与${meter}要求的${barBeats}拍不一致，请校对。`};notes.push(...values);}
  }else return {error:'播放说明无法准确转换，请使用音乐编辑器填写音符。'};
  if(!notes.length||notes.length>256||notes.some(n=>n.midi===null))return {error:'播放音符不完整，请校对。'};
  const playCount=Math.min(4,Math.max(1,Number(script.match(/(?:完整播放|播放|共)(\d+)遍/)?.[1])||3));
  const keySignature=content.keySignature||(/F大调|d小调/.test(script)?'F':/G大调|e小调/.test(script)?'G':'C');
  return {content:{...content,notes,bpm,meter,keySignature,clef:content.clef||'treble',category,audioSettings:{...content.audioSettings,playCount,gapBeats:script.includes('停8秒')?8*bpm/60:2,countInBeats,countInUnit:meter==='6/8'?1.5:1,prelude},musicConverted:true,listenOnly:subject==='dictation'}};
}
