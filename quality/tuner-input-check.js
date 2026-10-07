const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function setup() {
  const requests=[], tracks=[], nodes=[];
  const node=()=>{const n={frequency:{value:0},connect(){},disconnect(){this.disconnected=true}};nodes.push(n);return n};
  const context={sampleRate:48000,resume:async()=>{},createMediaStreamSource:node,createBiquadFilter:node,createAnalyser:node};
  const scope={window:{HetianCore:{audio:{getContext:()=>context}}},navigator:{mediaDevices:{getUserMedia:()=>new Promise((resolve,reject)=>requests.push({resolve,reject}))}},performance,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('vocal-pitch/tuner-engine.js','utf8'),scope);
  const input=new scope.window.MusicVocal.TunerEngine.Input();
  const stream=()=>{const track={stopped:false,stop(){this.stopped=true}};tracks.push(track);return {getTracks:()=>[track]}};
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {input,requests,tracks,nodes,stream,flush,context};
}
(async()=>{
  let x=setup();
  const first=x.input.start(),same=x.input.start();assert.equal(first,same);
  await x.flush();assert.equal(x.requests.length,1);
  x.input.stop();x.requests[0].resolve(x.stream());
  await assert.rejects(first,{name:'AbortError'});assert(x.tracks[0].stopped);assert.equal(x.input.analyser,null);
  const second=x.input.start();await x.flush();x.requests[1].resolve(x.stream());await second;
  assert(x.input.analyser);x.input.stop();assert(x.tracks[1].stopped);assert(x.nodes.every(n=>n.disconnected));
  x=setup();let fail=x.input.start();await x.flush();x.requests[0].reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}));await assert.rejects(fail);assert.equal(x.input.pending,null);
  const retry=x.input.start();await x.flush();x.requests[1].resolve(x.stream());await retry;assert(x.input.analyser);x.input.stop();
  x=setup();x.context.createAnalyser=()=>{throw new Error('graph failed')};fail=x.input.start();await x.flush();x.requests[0].resolve(x.stream());await assert.rejects(fail);assert(x.tracks[0].stopped);assert(x.nodes.every(n=>n.disconnected));
  x=setup();const old=x.input.start();await x.flush();x.input.stop();const fresh=x.input.start();await x.flush();x.requests[1].resolve(x.stream());await fresh;x.requests[0].resolve(x.stream());await assert.rejects(old);assert(x.input.analyser);assert(!x.tracks[0].stopped);assert(x.tracks[1].stopped);x.input.stop();
  const nativeScope={window:{},navigator:{},EventTarget,Event,CustomEvent,performance,setTimeout,clearTimeout,atob};
  vm.createContext(nativeScope);
  for(const file of ['constants.js','audio-input-manager.js','tuner-engine.js']) vm.runInContext(fs.readFileSync('vocal-pitch/'+file,'utf8'),nativeScope);
  let stopped=0;
  nativeScope.window.AndroidAudio={hasPermission:()=>true,startCapture:()=>true,getSampleRate:()=>48000,stopCapture:()=>stopped++,readPcmBase64:()=>''};
  const native=new nativeScope.window.MusicVocal.TunerEngine.Input();await native.start();assert(native.native);const pcm=new Float32Array(4096).fill(.5);native.analyser.getFloatTimeDomainData(pcm);assert(pcm.every(v=>v===0),'missing native PCM must not replay stale audio');nativeScope.window.AndroidAudio.isCaptureRunning=()=>false;assert.throws(()=>native.analyser.getFloatTimeDomainData(pcm),{name:'NotReadableError'});assert(pcm.every(v=>v===0));native.stop();assert.equal(stopped,1);
  const vocalSource=fs.readFileSync('vocal-pitch/vocal-pitch-page.js','utf8');
  const loopBody=vocalSource.split('    loop(now = performance.now()) {')[1].split('    smoothFrequency(frequency) {')[0].trim().replace(/}$/, '');
  let stoppedMessage='',detected=false;
  const controller={running:true,lastAnalysisAt:0,config:{analysisIntervalMs:1},manager:{analyser:{getFloatTimeDomainData(){throw new Error('capture ended')}}},detector:{detect(){detected=true}},buffer:new Float32Array(4),stop(message){this.running=false;stoppedMessage=message}};
  new Function('now','requestAnimationFrame',loopBody).call(controller,100,()=>1);
  assert.equal(controller.running,false);assert.equal(detected,false);assert.match(stoppedMessage,/重新启动/);
  console.log('PASS native capture and stale PCM; input deduplication, cancel during permission, retry after denial, graph failure cleanup, stale request isolation');
})().catch(error=>{console.error(error);process.exit(1)});
