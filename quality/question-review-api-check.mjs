import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {onRequestPost} from '../functions/api/admin/questions/[id]/review.js';
const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,email TEXT,display_name TEXT,role TEXT,learning_system TEXT,status TEXT);CREATE TABLE sessions(token TEXT,user_id INTEGER,expires_at TEXT,csrf TEXT);CREATE TABLE questions(id INTEGER PRIMARY KEY,created_by INTEGER,knowledge_id TEXT,version_no INTEGER,content TEXT,subject TEXT,question_type TEXT,status TEXT,review_notes TEXT,updated_at TEXT);INSERT INTO users VALUES(1,'student','s@test','S','learner','gaokao','active'),(2,'teacher','t@test','T','teacher','gaokao','active'),(3,'admin','a@test','A','admin','gaokao','active');INSERT INTO sessions VALUES('s',1,'2099-01-01','csrf'),('t',2,'2099-01-01','csrf'),('a',3,'2099-01-01','csrf');`);
const env={DB:{prepare(sql){const make=args=>({bind(...v){return make(v)},async first(){return db.prepare(sql).get(...args)||null},async run(){return db.prepare(sql).run(...args)}});return make([])}}};
const req=(sid,action)=>new Request('https://test.local/api/test',{method:'POST',headers:{cookie:`mb_sid=${sid}`,'x-csrf-token':'csrf','content-type':'application/json'},body:JSON.stringify({action})});
function seed(id,content){db.prepare("INSERT INTO questions VALUES(?,2,'listening',1,?,'dictation','single_choice','draft','','')").run(id,JSON.stringify({options:[content.answer,'另一答案'],...content}))}
seed(1,{prompt:'听辨',answer:'D5-C5-B4',audioScript:'钢琴等力度弹奏：D5-C5-B4。建议先给A4标准音，再播放3遍。'});seed(2,{prompt:'4/4节奏',answer:'节奏A',audioScript:'节拍器预备1小节后，以♩=72击读：ti-ti｜tika-tika｜ta；播放3遍。'});seed(3,{prompt:'听写旋律',answer:'教师人工评分',notes:[{midi:60,dur:1}]});seed(4,{prompt:'音程',answer:'小三度',musicData:{notes:[{midi:48,dur:1},{midi:51,dur:1}],tempo:84,clef:'bass'},audioSettings:{playMode:'harmonic',playCount:3}});
assert.equal((await onRequestPost({request:req('s','publish'),env,params:{id:1}})).status,403);
assert.equal((await onRequestPost({request:req('t','publish'),env,params:{id:1}})).status,200);let row=db.prepare('SELECT * FROM questions WHERE id=1').get();assert.equal(row.status,'published');assert.equal(JSON.parse(row.content).notes.length,3);
assert.equal((await onRequestPost({request:req('t','publish'),env,params:{id:2}})).status,400);assert.equal(db.prepare('SELECT status FROM questions WHERE id=2').get().status,'draft');
assert.equal((await onRequestPost({request:req('a','approve'),env,params:{id:3}})).status,400);
assert.equal((await onRequestPost({request:req('t','publish'),env,params:{id:4}})).status,200);row=JSON.parse(db.prepare('SELECT content FROM questions WHERE id=4').get().content);assert.equal(row.clef,'bass');assert.equal(row.bpm,84);assert(row.notes.every(n=>n.simultaneous));
db.prepare('UPDATE questions SET content=? WHERE id=2').run('broken json');assert.equal((await onRequestPost({request:req('a','archive'),env,params:{id:2}})).status,200,'broken content can still be archived');
console.log('PASS publication/approval require valid grades and audio, nested teacher music/harmony preserved, invalid drafts retained and archive available');
seed(5,{prompt:'无有效正确选项',options:['A','B'],answer:'C',notes:[{midi:60,dur:1}]});
assert.equal((await onRequestPost({request:req('t','publish'),env,params:{id:5}})).status,400);
assert.equal(db.prepare('SELECT status FROM questions WHERE id=5').get().status,'draft');

db.close();
