const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const storage=new Map([['haitang_state_owner_hobby','1']]),events=new Map();
 let state={profile:{username:'Student'},onboarding:{completed:true},learning:{totalQuestions:2},sessions:[]};
 let cloud={state:structuredClone(state),revision:'r1',userId:1}, conflict=false, offline=false, hold=null, writes=[];
 const user={id:1,role:'learner',profiles:{hobby:{name:'Student'}}};
 const window={HaitangProduct:{product:'music'},HetianEducation:{getState:()=>structuredClone(state),saveEducationState:s=>{state=s},resetEducationState:()=>{state={}},saveProfile:p=>{state.profile={username:p.username}}},addEventListener:(name,fn)=>events.set(name,fn),dispatchEvent(){},alert(){}};
 const scope={window,console,Date,JSON,String,Number,Boolean,Promise,Blob,URL,URLSearchParams,FormData,CustomEvent:class{},setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{search:'',reload(){}},document:{createElement:()=>({className:'',setAttribute(){},querySelectorAll:()=>[]}),body:{append(){}},getElementById:()=>null},fetch:async(url,options={})=>{
 if(url==='/api/csrf')return{ok:true,json:async()=>({csrfToken:'token'})};
 if(url==='/api/auth/session')return{ok:true,json:async()=>({user})};
 if(url.includes('/api/auth/state/')){
  if(options.method==='PUT'){
   const body=JSON.parse(options.body);writes.push(body);
   if(hold)await hold;
   if(offline)throw new Error('Offline');
   if(conflict)return{ok:false,status:409,json:async()=>({conflict:true,error:'Conflict'})};
   cloud={state:body.state,revision:'r'+(writes.length+1),userId:1};return{ok:true,status:200,json:async()=>({ok:true,revision:cloud.revision,userId:1})};
  }
  return{ok:true,json:async()=>cloud};
 }
 throw new Error('Unexpected '+url);
 }};
 vm.createContext(scope);vm.runInContext(fs.readFileSync('auth.js','utf8'),scope);
 const auth=window.HetianAuth;await auth.whenReady();assert.equal(auth.getSyncStatus().status,'synced');
 state.learning.totalQuestions=3;events.get('hetian:education-state')();assert.equal(auth.getSyncStatus().status,'pending');
 await auth.retrySync();assert.equal(auth.getSyncStatus().status,'synced');assert.equal(writes[0].expectedRevision,'r1');assert.equal(writes[0].userId,1);
 offline=true;state.learning.totalQuestions=4;events.get('hetian:education-state')();await assert.rejects(()=>auth.retrySync(),/Offline/);assert.equal(auth.getSyncStatus().status,'failed');
 offline=false;conflict=true;await assert.rejects(()=>auth.retrySync(),/Conflict/);assert.equal(auth.getSyncStatus().status,'conflict');const n=writes.length;await auth.retrySync();assert.equal(writes.length,n,'conflict cannot auto-overwrite');
 const marker=JSON.parse(storage.get('haitang_sync_hobby_1'));assert.equal(marker.dirty,true);assert.equal(marker.revision,'r2');
 console.log('PASS client sync pending/synced/failed/conflict states, revision forwarding, dirty marker and conflict overwrite guard');
})().catch(e=>{console.error(e);process.exit(1)});
