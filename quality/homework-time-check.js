const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['homework.js','admin-homework.js']){
 const code=fs.readFileSync(file,'utf8'),start=code.indexOf('  function serverDate('),end=code.indexOf('\n',code.indexOf('  const dateText =',start));
 const scope={Date};vm.runInNewContext(code.slice(start,end)+'\nparse=serverDate;format=dateText;',scope);
 const expected=Date.parse('2026-10-07T04:33:50Z');
 for(const text of ['2026-10-07 04:33:50','2026-10-07T04:33:50Z','2026-10-07T12:33:50+08:00','2026-10-07T12:33:50+0800'])assert.equal(scope.parse(text).getTime(),expected,file+': '+text);
 assert.equal(scope.format('invalid'),'—');assert.equal(scope.format(null),'—');
 assert.equal(scope.format('2026-10-07 04:33:50'),scope.format('2026-10-07T12:33:50+08:00'));
 assert.equal(fs.readFileSync('android-native/app/src/main/assets/'+file,'utf8'),code);
}
console.log('PASS student and teacher agree on SQLite UTC and ISO-offset timestamps, invalid dates and Android parity');
