const assert=require('node:assert/strict'),fs=require('node:fs');
const base='android-native/app/src/main/assets/';const html=fs.readFileSync(base+'index.html','utf8'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
for(const file of ['gaokao_system/gaokao-app.js','education/education-ui.js','vocal-pitch/tuner.js']){
 const code=fs.readFileSync(base+file,'utf8');for(const match of code.matchAll(/\$\('([^']+)'\)\./g))assert(ids.has(match[1]),file+' missing '+match[1]);
}
for(const id of ['gkTheoryStart','gkTheoryPractice','gkTheoryLanding','gkTheoryIntro','gkTheoryExam'])assert(ids.has(id));
assert.equal(fs.readFileSync(base+'auth.js','utf8'),fs.readFileSync('auth.js','utf8'));
console.log('PASS Android required UI controls, practice/exam entries and shared account logic');
// Bundled teacher entry must explain cloud requirements before attempting login.
const vm=require('node:vm');const nodes=Object.fromEntries(['loginForm','.teacher-login-footer','#loginCard h2','loginMessage'].map(id=>[id,{hidden:false,textContent:'',after(node){this.link=node;}}]));
let requests=0;vm.runInNewContext(fs.readFileSync(base+'teacher.js','utf8'),{window:{},location:{hostname:'appassets.androidplatform.net'},document:{getElementById:id=>nodes[id],querySelector:id=>nodes[id],createElement:()=>({})},fetch(){requests++;throw Error('Bundled page must not request account API');}});
assert.equal(requests,0);assert.equal(nodes.loginForm.hidden,true);assert.match(nodes.loginMessage.textContent,/网页版/);assert.equal(nodes.loginMessage.link.href,'https://educationmusicbox.pages.dev/teacher.html?product=exam');
for(const match of fs.readFileSync(base+'teacher.html','utf8').matchAll(/(?:src|href)="(\.\/[^"?]+)/g))assert(fs.existsSync(base+match[1].slice(2)),`Missing bundled teacher resource ${match[1]}`);
console.log('PASS bundled teacher entry uses existing local resources and explains online access without a failing login');
