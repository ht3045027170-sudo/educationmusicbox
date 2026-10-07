const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const calls=[];let provider='cloud-homr';
 const scope={console,AbortController,setTimeout,clearTimeout,URLSearchParams,location:{protocol:'https:',hostname:'test.local'},navigator:{userAgent:'test'},localStorage:{getItem:()=>null},window:{},fetch:async(url,options={})=>{
 calls.push({url,options});if(url==='/api/omr/health')return{ok:true,json:async()=>({provider,ready:true})};
 if(url==='/api/csrf')return{ok:true,json:async()=>({csrfToken:'token'})};
 return{ok:true,json:async()=>({ok:true,result:{notes:[]}})};
 }};
 vm.createContext(scope);vm.runInContext(fs.readFileSync('sight-singing/omr-provider.js','utf8'),scope);
 await scope.window.HetianOMR.recognize({imageDataUrl:'test'},'cloud-homr');
 assert.equal(calls.at(-1).options.headers['x-csrf-token'],'token');
 const prior=calls.filter(c=>c.url==='/api/omr/recognize').length;
 await assert.rejects(()=>scope.window.HetianOMR.recognize({},'android-native-homr'),/处理位置已改变/);
 assert.equal(calls.filter(c=>c.url==='/api/omr/recognize').length,prior,'changed processing location must block transmission');
 console.log('PASS cloud CSRF propagation and changed-provider transmission guard');
})().catch(e=>{console.error(e);process.exit(1)});
