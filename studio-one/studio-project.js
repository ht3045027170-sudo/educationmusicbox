(() => {
  'use strict';
  const NS = window.HetianDAW = window.HetianDAW || {};
  const PPQ = 480;
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clone = value => JSON.parse(JSON.stringify(value));
  const colours = ['#ef5350','#ec407a','#7e57c2','#42a5f5','#26a69a','#ffb74d','#8d9b50'];
  function track(name = '钢琴', index = 0, type = 'instrument') {
    return { id: uid('track'), name, type, color:colours[index%colours.length], icon:type==='audio'?'≈':'♩',
      clips:[], automationLanes:[], instrument:type==='audio'?null:{id:'piano',name:'钢琴'}, midiChannel:index+1,
      volume:.82, pan:0, mute:false, solo:false, armed:false, monitoring:false, locked:false, hidden:false, height:92 };
  }
  function clip(trackId, startTick = 0, lengthTicks = PPQ * 16) {
    return { id:uid('clip'),trackId,type:'midi',name:'MIDI 片段',startTick,lengthTicks,loopEnabled:false,loopStartTick:0,
      loopLengthTicks:lengthTicks,muted:false,locked:false,color:null,notes:[],controllers:[],programChanges:[] };
  }
  function note(pitch=60,startTick=0,durationTicks=PPQ,velocity=96,channel=1) {
    return {id:uid('note'),pitch,startTick,durationTicks,velocity,channel,muted:false};
  }
  function project(name='未命名工程') {
    const first=track('Grand Piano',0),second=track('Harmony',1);
    return {id:uid('project'),schemaVersion:3,name,createdAt:Date.now(),updatedAt:Date.now(),ppq:PPQ,
      tempoMap:[{id:uid('tempo'),tick:0,bpm:120}],timeSignatureMap:[{id:uid('meter'),tick:0,numerator:4,denominator:4}],
      keySignatureMap:[{id:uid('key'),tick:0,key:'C'}],markers:[],tracks:[first,second],
      master:{volume:.86,mute:false,limiter:true},loop:{enabled:false,startTick:0,endTick:PPQ*16},
      settings:{bars:16,snap:'1/4',metronome:false,countIn:false,follow:true,zoom:1,bottom:'piano',theme:'dark'}};
  }
  function migrate(raw) {
    if(!raw||typeof raw!=='object')throw Error('无效工程文件');
    raw.schemaVersion ||= 1; raw.ppq ||= PPQ; raw.id ||= uid('project'); raw.name ||= '导入工程';
    raw.tempoMap ||= [{id:uid('tempo'),tick:0,bpm:raw.bpm||120}];
    raw.timeSignatureMap ||= [{id:uid('meter'),tick:0,numerator:+String(raw.meter||'4/4').split('/')[0]||4,denominator:+String(raw.meter||'4/4').split('/')[1]||4}];
    raw.tracks ||= []; raw.tracks.forEach((item,index)=>{item.id||=uid('track');item.type||='instrument';item.icon||=item.type==='audio'?'≈':'♩';item.color||=colours[index%colours.length];item.clips||=[];item.automationLanes||=[];item.volume??=.82;item.pan??=0;if(item.type!=='audio')item.instrument||={id:'piano',name:'钢琴'};item.clips.forEach(region=>{region.id||=uid('clip');region.trackId=item.id;region.type||=item.type==='audio'?'audio':'midi';region.notes||=[];region.notes.forEach(event=>{event.id||=uid('note');if(event.midi!=null&&event.pitch==null)event.pitch=event.midi;if(event.start!=null&&event.startTick==null)event.startTick=Math.round(event.start*PPQ);if(event.duration!=null&&event.durationTicks==null)event.durationTicks=Math.round(event.duration*PPQ);event.velocity=event.velocity<=1?Math.round(event.velocity*127):event.velocity})})});
    raw.master ||= {volume:.86,mute:false,limiter:true};raw.loop ||= {enabled:false,startTick:0,endTick:PPQ*16};
    raw.settings={bars:16,snap:'1/4',metronome:false,countIn:false,follow:true,zoom:1,bottom:'piano',theme:'dark',...(raw.settings||{})};raw.schemaVersion=3;return raw;
  }
  class CommandManager {
    constructor(onChange){this.undoStack=[];this.redoStack=[];this.onChange=onChange}
    run(label,doAction,undoAction){doAction();this.undoStack.push({label,doAction,undoAction});if(this.undoStack.length>150)this.undoStack.shift();this.redoStack=[];this.onChange(label)}
    undo(){const action=this.undoStack.pop();if(!action)return;action.undoAction();this.redoStack.push(action);this.onChange('撤销 '+action.label)}
    redo(){const action=this.redoStack.pop();if(!action)return;action.doAction();this.undoStack.push(action);this.onChange('重做 '+action.label)}
    clear(){this.undoStack=[];this.redoStack=[]}
  }
  class Repository {
    constructor(){this.db=null}
    async open(){if(this.db)return this.db;if(!('indexedDB' in window))return null;this.db=await new Promise((resolve,reject)=>{const req=indexedDB.open('HetianMidiLabDB',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('projects'))req.result.createObjectStore('projects',{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});return this.db}
    async put(value){value.updatedAt=Date.now();const db=await this.open();if(!db){localStorage.setItem('hetianDawProjectV3',JSON.stringify(value));return}await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});localStorage.setItem('hetianDawLastId',value.id);const recent=this.recent().filter(item=>item.id!==value.id);recent.unshift({id:value.id,name:value.name,updatedAt:value.updatedAt});localStorage.setItem('hetianDawRecentV3',JSON.stringify(recent.slice(0,10)))}
    async get(id){const db=await this.open();if(!db)return JSON.parse(localStorage.getItem('hetianDawProjectV3')||'null');return new Promise((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}
    recent(){try{return JSON.parse(localStorage.getItem('hetianDawRecentV3')||'[]')}catch(_){return[]}}
  }
  NS.model={PPQ,uid,clone,colours,track,clip,note,project,migrate,CommandManager,Repository};
})();
