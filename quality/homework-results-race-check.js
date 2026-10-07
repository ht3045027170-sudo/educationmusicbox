const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('admin-homework.js','utf8'),a=code.indexOf('  const resultRequests ='),b=code.indexOf('  detail.onclick =',a);
let resolve,reject;const box={isConnected:true,innerHTML:'',querySelector:()=>({}),querySelectorAll:()=>[]},button={isConnected:true,disabled:false};
const scope={WeakMap,detail:{querySelector:()=>box},systemSelect:{value:'gaokao'},selectedClass:1,detailGeneration:1,esc:s=>String(s).replace(/</g,'&lt;'),answerText:String,dateText:String,api:()=>new Promise((yes,no)=>{resolve=yes;reject=no})};
vm.runInNewContext(code.slice(a,b)+'\nload=loadAssignmentResults;',scope);
(async()=>{
 let pending=scope.load(1,button);assert.equal(button.disabled,true);scope.detailGeneration++;box.innerHTML='NEW CLASS';resolve({items:[],questions:[],summary:{}});await pending;assert.equal(box.innerHTML,'NEW CLASS');assert.equal(button.disabled,false);
 pending=scope.load(1,button);reject(Error('<network failure>'));await pending;assert(box.innerHTML.includes('role="alert"'));assert(box.innerHTML.includes('&lt;network failure>'));assert.equal(button.disabled,false);
 pending=scope.load(1,button);box.isConnected=false;box.innerHTML='REMOVED';reject(Error('late failure'));await pending;assert.equal(box.innerHTML,'REMOVED');box.isConnected=true;
 pending=scope.load(1,button);resolve({items:[],questions:[],summary:{total:0,completed:0,pending:0}});await pending;assert(box.innerHTML.includes('0 名学生'));assert.equal(button.disabled,false);
 console.log('PASS late class results ignored, visible escaped errors, detached box protection, button recovery and empty reports');
})().catch(e=>{console.error(e);process.exitCode=1});
