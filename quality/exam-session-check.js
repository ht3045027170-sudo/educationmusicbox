const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(saved={}) {
 const nodes=new Map(), events=new Map(), state=structuredClone(saved), records=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){this[type]=fn},querySelectorAll(){return[]},textContent:'',innerHTML:''});return nodes.get(id)};
 const scope={console,Date,Math,CustomEvent:class{},setTimeout,clearTimeout,setInterval:()=>1,clearInterval,document:{getElementById:node,querySelectorAll:()=>[]},window:{confirm:()=>true,addEventListener:(name,fn)=>events.set(name,fn),GaokaoStore:{getState:()=>structuredClone(state),update(fn){fn(state)},recordAnswer:a=>records.push(a),finishSession(){},weakKnowledge:()=>[]},HetianApp:{showPage(){}},GAOKAO_THEORY_BANK:{questions:[{id:'q1',category:'音程',options:['A','B'],answer:'A',prompt:'Question',explanation:'Secret',difficulty:1}]}}};
 vm.createContext(scope);vm.runInContext(fs.readFileSync('gaokao_system/gaokao-app.js','utf8'),scope);
 return{scope,node,state,records,events};
}
const one=setup();one.scope.window.GaokaoApp.startTheorySession('音程');
assert(one.state.activeTheorySession);assert.equal(one.records.length,0);
// Trigger actual registered answer callbacks through captured option nodes.
let callbacks=[];one.node('gkOptions').querySelectorAll=()=>['A','B'].map(answer=>({dataset:{gkAnswer:answer},addEventListener(type,fn){callbacks.push(fn)}}));
one.scope.window.GaokaoApp.openTheory();callbacks[1]();assert.equal(one.records.length,0);assert(!one.node('gkExplanation').innerHTML.includes('Secret'));assert(!one.node('gkOptions').innerHTML.includes('disabled'));
callbacks=[];one.scope.window.GaokaoApp.openTheory();callbacks[0]();assert.equal(one.state.activeTheorySession.answers[0].userAnswer,'A');
const resumed=setup(one.state);resumed.scope.window.GaokaoApp.openTheory();assert(resumed.node('gkOptions').innerHTML.includes('aria-pressed="true"'));resumed.node('gkTheorySubmit').click();assert.equal(resumed.records.length,1);assert.equal(resumed.records[0].correct,true);assert.equal(resumed.state.activeTheorySession,null);resumed.node('gkTheorySubmit').click();assert.equal(resumed.records.length,1);
const expired=structuredClone(one.state);expired.activeTheorySession.deadline=Date.now()-1000;const timed=setup(expired);timed.scope.window.GaokaoApp.openTheory();assert.equal(timed.records.length,1);assert.equal(timed.state.activeTheorySession,null);
console.log('PASS editable choices, hidden feedback, deferred single grading, draft recovery, expired draft auto-submission');
const practice=setup();practice.scope.window.GaokaoApp.startTheorySession('音程','practice');let practiceCallbacks=[];
practice.node('gkOptions').querySelectorAll=()=>['A','B'].map(answer=>({dataset:{gkAnswer:answer},addEventListener(type,fn){practiceCallbacks.push(fn)}}));
practice.scope.window.GaokaoApp.openTheory();practiceCallbacks[0]();assert.equal(practice.records.length,1);assert(practice.node('gkExplanation').innerHTML.includes('Secret'));assert(practice.node('gkOptions').innerHTML.includes('disabled'));assert.equal(practice.node('gkTheoryTimer').textContent,'不限时练习');practice.node('gkTheorySubmit').click();assert.equal(practice.records.length,1,'practice records must not be duplicated at completion');
console.log('PASS practice immediate explanations, untimed session, locked reviewed choice and no duplicate grading');
