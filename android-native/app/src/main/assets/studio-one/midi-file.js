(() => {
  'use strict';
  const NS=window.HetianDAW=window.HetianDAW||{};
  const {uid,track,clip,note}=NS.model;
  const text=new TextDecoder();
  function vlq(data,state){let value=0,b;do{b=data[state.i++];value=(value<<7)|(b&127)}while(b&128);return value}
  function readU16(data,state){return(data[state.i++]<<8)|data[state.i++]}
  function readU32(data,state){return((data[state.i++]<<24)>>>0)+(data[state.i++]<<16)+(data[state.i++]<<8)+data[state.i++]}
  function importMidi(buffer) {
    const data=new Uint8Array(buffer),state={i:0};if(text.decode(data.slice(0,4))!=='MThd')throw Error('不是标准 MIDI 文件');
    state.i=4;const headerLength=readU32(data,state),format=readU16(data,state),trackCount=readU16(data,state),division=readU16(data,state);state.i=8+headerLength;
    if(division&0x8000)throw Error('暂不支持 SMPTE 时间格式 MIDI');
    const result={format,division,tempo:120,tracks:[]};
    for(let t=0;t<trackCount;t++){if(text.decode(data.slice(state.i,state.i+4))!=='MTrk')throw Error('MIDI 轨道数据损坏');state.i+=4;const trackLength=readU32(data,state),end=state.i+trackLength,events=[],open=new Map(),notes=[],controllers=[],programChanges=[];let tick=0,running=0,name=`MIDI Track ${t+1}`;
      while(state.i<end){tick+=vlq(data,state);let status=data[state.i++];if(status<0x80){if(!running)throw Error('MIDI Running Status 数据损坏');state.i--;status=running}else if(status<0xf0)running=status;
        if(status===0xff){const type=data[state.i++],length=vlq(data,state),payload=data.slice(state.i,state.i+length);state.i+=length;if(type===0x03)name=text.decode(payload);if(type===0x51&&length===3)result.tempo=60000000/((payload[0]<<16)|(payload[1]<<8)|payload[2]);if(type===0x2f)break;continue}
        if(status===0xf0||status===0xf7){state.i+=vlq(data,state);continue}
        const command=status&0xf0,channel=(status&15)+1,a=data[state.i++],b=(command===0xc0||command===0xd0)?0:data[state.i++];
        if(command===0x90&&b>0)open.set(`${channel}:${a}`,{tick,velocity:b,channel});
        else if(command===0x80||(command===0x90&&b===0)){const started=open.get(`${channel}:${a}`);if(started){notes.push({id:uid('note'),pitch:a,startTick:started.tick,durationTicks:Math.max(1,tick-started.tick),velocity:started.velocity,channel,muted:false});open.delete(`${channel}:${a}`)}}
        else if(command===0xb0)controllers.push({id:uid('cc'),tick,controller:a,value:b,channel});
        else if(command===0xc0)programChanges.push({id:uid('pc'),tick,program:a,channel});
        events.push({tick,status,a,b});
      }
      if(notes.length||controllers.length||programChanges.length){const first=Math.min(...notes.map(n=>n.startTick),0),last=Math.max(...notes.map(n=>n.startTick+n.durationTicks),division*4),region=clip('',Math.floor(first/division)*division,Math.max(division,last-first));region.name=name;region.notes=notes.map(n=>({...n,startTick:n.startTick-region.startTick}));region.controllers=controllers;region.programChanges=programChanges;result.tracks.push({name,region})}
      state.i=end;
    }
    return result;
  }
  function variable(value){let buffer=value&127,out=[];while(value>>=7){buffer<<=8;buffer|=(value&127)|128}while(true){out.push(buffer&255);if(buffer&128)buffer>>=8;else break}return out}
  const u32=value=>[(value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255];
  function exportMidi(project) {
    const ppq=project.ppq||480,bpm=project.tempoMap[0]?.bpm||120,meter=project.timeSignatureMap[0]||{numerator:4,denominator:4},tracks=[];
    const conductor=[0,0xff,0x51,3,...u32(Math.round(60000000/bpm)).slice(1),0,0xff,0x58,4,meter.numerator,Math.round(Math.log2(meter.denominator)),24,8,0,0xff,0x2f,0];tracks.push(conductor);
    project.tracks.forEach((item,index)=>{const events=[],channel=Math.max(0,Math.min(15,(item.midiChannel||index+1)-1));item.clips.forEach(region=>{if(region.muted)return;(region.notes||[]).forEach(n=>{if(n.muted)return;const start=region.startTick+n.startTick,end=start+n.durationTicks,velocity=Math.max(1,Math.min(127,Math.round(n.velocity||96)));events.push({tick:start,order:1,data:[0x90|channel,n.pitch,velocity]},{tick:end,order:0,data:[0x80|channel,n.pitch,0]})});(region.controllers||[]).forEach(cc=>{const ccChannel=Math.max(0,Math.min(15,(cc.channel||channel+1)-1));events.push({tick:region.startTick+(cc.tick||0),order:0,data:[0xb0|ccChannel,Math.max(0,Math.min(127,cc.controller||0)),Math.max(0,Math.min(127,cc.value||0))]})});(region.programChanges||[]).forEach(change=>{const pcChannel=Math.max(0,Math.min(15,(change.channel||channel+1)-1));events.push({tick:region.startTick+(change.tick||0),order:0,data:[0xc0|pcChannel,Math.max(0,Math.min(127,change.program||0))]})})});events.sort((a,b)=>a.tick-b.tick||a.order-b.order);const nameBytes=[...new TextEncoder().encode(item.name)],bytes=[0,0xff,3,...variable(nameBytes.length),...nameBytes];let previous=0;events.forEach(event=>{bytes.push(...variable(event.tick-previous),...event.data);previous=event.tick});bytes.push(0,0xff,0x2f,0);tracks.push(bytes)});
    const header=[77,84,104,100,0,0,0,6,0,1,(tracks.length>>8)&255,tracks.length&255,(ppq>>8)&255,ppq&255],bytes=[...header];tracks.forEach(item=>bytes.push(77,84,114,107,...u32(item.length),...item));return new Blob([new Uint8Array(bytes)],{type:'audio/midi'});
  }
  NS.midiFile={importMidi,exportMidi};
})();
