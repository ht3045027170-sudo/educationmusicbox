const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync('tuner.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
for(const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)) assert(fs.existsSync(match[1].split('?')[0]),match[1]);
assert(!html.includes('src="auth.js"'),'public tuning must not depend on auth boot');
for(const id of ['guitar','erhu','tunerMic','erhuTunerMic','shareTargets','shareForm','lessonTargets'])assert(ids.includes(id));
for(const name of ['tuner.html','vocal-pitch/tuner.js','vocal-pitch/public-tuner.js'])assert.equal(fs.readFileSync(name,'utf8'),fs.readFileSync(path.join('android-native/app/src/main/assets',name),'utf8'),name+' Android parity');
console.log('PASS standalone tuner resources, unique controls, independent auth boot and Android parity');
