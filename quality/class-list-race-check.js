const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('admin-homework.js','utf8'),a=code.indexOf('  async function loadClasses('),b=code.indexOf('  async function openClass(',a),calls=[];
const scope={classListGeneration:0,detailGeneration:1,selectedClass:2,systemSelect:{value:'gaokao'},classList:{innerHTML:''},detail:{innerHTML:''},esc:String,api:url=>new Promise((resolve,reject)=>calls.push({url,resolve,reject}))};
vm.runInNewContext(code.slice(a,b)+'\nload=loadClasses;',scope);
(async()=>{
 const old=scope.load();scope.systemSelect.value='hobby';const latest=scope.load();assert.equal(calls[0].url,'/api/teaching/gaokao/classes');calls[1].resolve({items:[{id:2,name:'音乐班',invite_code:'TEST',student_count:1,assignment_count:0}]});await latest;const html=scope.classList.innerHTML;calls[0].resolve({items:[]});await old;assert.equal(scope.classList.innerHTML,html);assert.equal(scope.selectedClass,2);
 const failure=scope.load();calls[2].reject(Error('网络失败'));await failure;assert(scope.classList.innerHTML.includes('role="alert"'));assert(scope.classList.innerHTML.includes('网络失败'));
 const removed=scope.load();calls[3].resolve({items:[]});await removed;assert.equal(scope.selectedClass,null);assert.equal(scope.detailGeneration,2);assert(scope.detail.innerHTML.includes('选择一个班级'));
 console.log('PASS old system class lists ignored, visible errors and removed class invalidates detail');
})().catch(error=>{console.error(error);process.exitCode=1});
