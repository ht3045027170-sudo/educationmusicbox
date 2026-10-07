const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let user={id:1,role:'admin'},response={ok:true,license:{type:'free',status:'active',features:['basic_tools'],userId:1,verified:true}},waiting=null;const events=new Map();
 const scope={console,Date,CustomEvent:class{},window:{HetianEducation:{getState:()=>({license:{type:'developer',features:['*']},unlockState:{allLevels:true}})},HetianAuth:{getUser:()=>user},addEventListener:(name,fn)=>events.set(name,fn),dispatchEvent(){}},fetch:async(url)=>{if(url==='/api/csrf')return{json:async()=>({csrfToken:'token'})};if(waiting)await waiting;return{ok:true,json:async()=>response}}};
 vm.createContext(scope);vm.runInContext(fs.readFileSync('education/license-manager.js','utf8'),scope);const L=scope.window.LicenseManager;
 assert.equal(L.canAccess('advanced_level'),false);assert.equal(L.hasAdminUnlock(),false,'local role and local license cannot grant admin');
 await L.refresh();assert.equal(L.canAccess('advanced_level'),false);
 response={ok:true,license:{type:'student_pro',status:'active',features:['advanced_level'],userId:1,verified:true}};await L.refresh();assert(L.canAccess('advanced_level'));
 response.license.expireDate='2000-01-01T00:00:00Z';await L.refresh();assert(!L.canAccess('advanced_level'));
 response={ok:true,license:{type:'developer',status:'active',features:['*'],userId:1,verified:true}};
 let release;waiting=new Promise(resolve=>release=resolve);const pending=L.refresh();user={id:2,role:'learner'};L.deactivate();release();await pending;assert(!L.hasAdminUnlock());assert(!L.canAccess('advanced_level'));
 assert.equal(L.toggleTestCode,undefined);
 console.log('PASS client rejects imported entitlements/local admin role, checks server expiration, rejects late account responses and removes test toggle');
})().catch(e=>{console.error(e);process.exit(1)});
