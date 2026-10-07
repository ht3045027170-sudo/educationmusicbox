const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const code=fs.readFileSync('homework.js','utf8'),a=code.indexOf('  let viewGeneration='),b=code.indexOf('  const isTeacher =',a),c=code.indexOf('  async function openAssignment('),d=code.indexOf('  function showError(',c),calls=[];let actor=1;
const node={disabled:false,addEventListener(){}},dialog={open:true,innerHTML:'',querySelector:()=>node,querySelectorAll:()=>[],showModal(){this.open=true}};
const scope={user:()=>({id:actor}),window:{MusicEditor:{stopPlayback(){}}},dialog,api:()=>new Promise((resolve,reject)=>calls.push({resolve,reject})),ensureMusicRenderer:async()=>{},esc:String,dateText:String,showError:(title,error)=>dialog.innerHTML='ERROR '+error.message};
vm.runInNewContext(code.slice(a,b)+code.slice(c,d)+'\nload=openAssignment;invalidate=()=>viewGeneration++;',scope);
const response=title=>({assignment:{title,can_submit:false,sections:[]},questions:[]});
(async()=>{
 const old=scope.load('gaokao',1),latest=scope.load('gaokao',2);calls[1].resolve(response('NEW'));await latest;const html=dialog.innerHTML;calls[0].resolve(response('OLD'));await old;assert.equal(dialog.innerHTML,html);assert(html.includes('NEW'));
 const previousUser=scope.load('gaokao',3);actor=2;calls[2].resolve(response('PRIVATE OLD USER'));await previousUser;assert.equal(dialog.innerHTML,html);
 const closed=scope.load('gaokao',4);scope.invalidate();dialog.innerHTML='CLOSED';calls[3].reject(Error('late failure'));await closed;assert.equal(dialog.innerHTML,'CLOSED');
 const failure=scope.load('gaokao',5);calls[4].reject(Error('network'));await failure;assert.equal(dialog.innerHTML,'ERROR network');
 console.log('PASS real student assignment loader ignores stale pages/accounts and late failures; current errors are shown');
})().catch(error=>{console.error(error);process.exitCode=1});
