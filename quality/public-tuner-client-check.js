const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(fetcher){
 const elements=new Map(),listeners=new Map(),calls=[];
 function element(id=''){return {id,hidden:false,disabled:false,value:'',textContent:'',children:[],classList:{toggle(){}},setAttribute(name,value){this[name]=value},replaceChildren(){this.children=[]},append(child){this.children.push(child)},querySelectorAll(){return this.children},click(){},focus(){},select(){}}}
 const get=id=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id)};
 const window={MusicVocal:{TunerEngine:{parseTarget(note){return /^[A-G][#b]?[2-6]$/.test(note)?{note}:null}},tuner:{selectTarget(){},stop(){}}},addEventListener(name,fn){listeners.set(name,fn)},dispatchEvent(){}};
 const document={baseURI:'https://test.local/tuner.html',getElementById:get,querySelectorAll(){return []},createElement:element};
 const context=vm.createContext({window,document,URL,URLSearchParams,Blob,navigator:{clipboard:{}},setTimeout(){},CustomEvent:class{},location:{search:'?lesson=lesson-token',href:'https://test.local/tuner.html?lesson=lesson-token'},fetch:async(url,options)=>{calls.push({url,options});return fetcher(url,options)}});
 vm.runInContext(fs.readFileSync('vocal-pitch/tuning-session.js','utf8'),context);vm.runInContext(fs.readFileSync('vocal-pitch/public-tuner.js','utf8'),context);
 return {get,calls,emit(detail){listeners.get('haitang:tuner-reading')({detail})},share(){get('shareTitle').value='自己的练习';get('shareTargets').value='E2';get('shareInstrument').value='guitar';get('shareForm').onsubmit({preventDefault(){}})}};
}
const ok=data=>({ok:true,json:async()=>data}),lesson={lesson:{token:'lesson-token',title:'老师的练习',targets:['E2','A2'],instrument:'guitar'}};
(async()=>{
 let state=fixture(async url=>ok(url.startsWith('/api/tuning/')?lesson:{user:null}));await flush();assert.equal(state.get('saveTuning').hidden,false);
 for(let i=0;i<4;i++)state.emit({note:'E2',instrument:'guitar',cents:0,stable:true,at:i*200});
 const progress=state.get('lessonProgress').textContent;await state.get('saveTuning').onclick();assert.equal(state.get('tuningLogin').hidden,false);assert.equal(state.get('lessonProgress').textContent,progress);assert.match(state.get('tuningSaveStatus').textContent,/当前记录会保留/);assert.equal(state.calls.filter(call=>call.options?.method==='POST').length,0);
 state=fixture(async(url,options)=>ok(options?.method==='POST'?{ok:true}:url==='/api/auth/session'?{user:{id:7}}:url==='/api/csrf'?{csrfToken:'actual-csrf'}:lesson));await flush();await state.get('saveTuning').onclick();
 const post=state.calls.find(call=>call.options?.method==='POST');assert.equal(post.url,'/api/tuning/lesson-token');assert.equal(post.options.headers['x-csrf-token'],'actual-csrf');const body=JSON.parse(post.options.body);assert.equal(body.userId,7);assert.equal(body.consent,true);assert.deepEqual(Object.keys(body).sort(),['consent','summary','userId']);assert.equal(body.summary.length,2);assert(!JSON.stringify(body).includes('audio'));assert.match(state.get('tuningSaveStatus').textContent,/稳定完成 0\/2/);
 let resolveLoad;state=fixture(()=>new Promise(resolve=>{resolveLoad=resolve}));state.share();resolveLoad(ok(lesson));await flush();assert.equal(state.get('lessonTitle').textContent,'自己的练习');assert.equal(state.get('saveTuning').hidden,true);
 let resolveSave;state=fixture(async(url,options)=>options?.method==='POST'?new Promise(resolve=>{resolveSave=resolve}):ok(url==='/api/auth/session'?{user:{id:7}}:url==='/api/csrf'?{csrfToken:'actual-csrf'}:lesson));await flush();const saving=state.get('saveTuning').onclick();await flush();state.share();resolveSave(ok({ok:true}));await saving;assert.equal(state.get('tuningSaveStatus').textContent,'');assert.equal(state.get('lessonTitle').textContent,'自己的练习');
 state=fixture(async()=>({ok:false,json:async()=>({error:'练习链接无效。'})}));await flush();assert.match(state.get('lessonLoadStatus').textContent,/练习链接无效/);
 console.log('PASS public lesson loading, retained guest records, explicit consent/CSRF/account identity and late response isolation');
})().catch(error=>{console.error(error);process.exitCode=1});
