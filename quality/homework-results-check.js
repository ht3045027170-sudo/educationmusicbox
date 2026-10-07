const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('admin-homework.js','utf8'),start=code.indexOf('  function answerText('),end=code.indexOf('  function serverDate(',start),scope={};
vm.runInNewContext(code.slice(start,end)+'\nformat=answerText;',scope);
assert.equal(scope.format(['C3','E3']),'C3、E3');assert.equal(scope.format([]),'未作答');assert.equal(scope.format('  '),'未作答');assert.equal(scope.format(0),'0');assert.equal(scope.format(null),'未作答');assert.equal(scope.format('<script>'),'<script>');
assert(code.includes('esc(answerText(d.given))'));assert(code.includes('esc(answerText(q.answer))'));
assert.equal(fs.readFileSync('android-native/app/src/main/assets/admin-homework.js','utf8'),code);
console.log('PASS typed multiple answers, empty answers, zero and escaped teacher result rendering');
