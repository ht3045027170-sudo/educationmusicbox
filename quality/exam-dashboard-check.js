const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, { style: {}, textContent: '', innerHTML: '', addEventListener() {}, querySelectorAll: () => [] });
  return nodes.get(id);
};
const context = {
  console, Date, Math, setTimeout, clearTimeout, clearInterval,
  CustomEvent: class {},
  localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: node, querySelectorAll: () => [] },
  window: { addEventListener() {}, dispatchEvent() {}, HetianApp: { showPage() {} },
    GAOKAO_THEORY_BANK: { questions: [{ id: 'fixture', category: '音程' }] } }
};
vm.createContext(context);
for (const file of ['gaokao-state.js', 'gaokao-app.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'gaokao_system', file), 'utf8'), context);
}
const store = context.window.GaokaoStore;
function render() { context.window.GaokaoApp.openDashboard(); }
render();
assert.equal(node('gkTheoryPercent').textContent, '0%');
assert.match(node('gkWeakList').innerHTML, /等待真实训练数据/);
store.update(state => {
  state.daily[store.isoDate()] = { theoryQuestions: 15, dictationQuestions: 5, sightSingingCount: 1 };
  state.answers = [{ category: 'theory', correct: true }];
  state.mastery = {
    a: { knowledgeId: 'gaokao.theory.interval.major_third', category: 'theory', attempts: 2, recent: [0, 0], recentAccuracy: 0 },
    b: { knowledgeId: 'gaokao.theory.interval.perfect_fifth', category: 'theory', attempts: 4, recent: [1, 1, 0, 0], recentAccuracy: 50 },
    c: { knowledgeId: 'gaokao.dictation.interval', category: 'dictation', attempts: 2, recent: [0, 0], recentAccuracy: 0 }
  };
});
render();
assert.equal(node('gkTheoryPercent').textContent, '50%');
assert.equal(node('gkDictationPercent').textContent, '25%');
assert.equal(node('gkSightPercent').textContent, '100%');
assert.equal(node('gkTheoryBar').style.width, '50%');
assert.match(node('gkTheoryStats').textContent, /完成 15\/30 题/);
assert.match(node('gkTheoryStats').textContent, /暂无正确率记录/);
store.update(state => { state.daily[store.isoDate()].theoryCorrect = 9; state.daily[store.isoDate()].dictationCorrect = 2; });
render();
assert.match(node('gkTheoryStats').textContent, /今日正确率 60%（9\/15）/);
assert.match(node('gkDictationStats').textContent, /今日正确率 40%（2\/5）/);
const weak = node('gkWeakList').innerHTML;
assert.equal((weak.match(/<b>音程<\/b>/g) || []).length, 1);
assert.match(weak, /<b>音程听记<\/b>/);
assert.match(weak, /最近正确率 33% · 6 次练习/);
assert.doesNotMatch(weak, /<b>dictation<\/b>/);
assert.equal(Object.keys(store.getState().mastery).length, 3);
assert.equal(store.weakKnowledge(6).length, 3);
store.update(state => {
  state.daily[store.isoDate()].theoryQuestions = 40;
  state.daily[store.isoDate()].dictationQuestions = 30;
});
render();
assert.equal(node('gkTheoryPercent').textContent, '100%');
assert.match(node('gkTheoryStats').textContent, /完成 40\/30 题/);
assert.equal(node('gkDictationPercent').textContent, '100%');
store.update(state => { state.daily = {}; });
render();
assert.equal(node('gkTheoryPercent').textContent, '0%');
assert.equal(node('gkDictationPercent').textContent, '0%');
assert.equal(node('gkSightPercent').textContent, '0%');
console.log('exam dashboard progress and knowledge summaries: ok');
