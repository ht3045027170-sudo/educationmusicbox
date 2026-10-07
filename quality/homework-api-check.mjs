import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost as submit } from '../functions/api/learning/[system]/assignments/[id]/submit.js';
import { onRequestGet as detail } from '../functions/api/learning/[system]/assignments/[id].js';
import { onRequestGet as teacherResults } from '../functions/api/teaching/[system]/assignments/[id]/results.js';
import { onRequestPost as publish } from '../functions/api/teaching/[system]/classes/[classId]/assignments.js';
const db = new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT,email TEXT,display_name TEXT,role TEXT,learning_system TEXT,status TEXT);
CREATE TABLE sessions(token TEXT,user_id INTEGER,expires_at TEXT,csrf TEXT);
CREATE TABLE classes(id INTEGER PRIMARY KEY,teacher_id INTEGER,system_code TEXT);
CREATE TABLE class_students(class_id INTEGER,student_id INTEGER);
CREATE TABLE questions(id INTEGER PRIMARY KEY,system_code TEXT,status TEXT,question_type TEXT,content TEXT,subject TEXT DEFAULT 'theory');
CREATE TABLE homework_assignments(id INTEGER PRIMARY KEY AUTOINCREMENT,class_id INTEGER,teacher_id INTEGER,title TEXT,instructions TEXT,subject TEXT,question_ids TEXT,due_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE homework_submissions(assignment_id INTEGER,student_id INTEGER,answers TEXT,score REAL,wrong_count INTEGER,submitted_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO users VALUES(1,'student','s@example.test','S','learner','gaokao','active'),(2,'teacher','t@example.test','T','teacher','gaokao','active');
INSERT INTO sessions VALUES('student',1,'2099-01-01','csrf'),('teacher',2,'2099-01-01','csrf');
INSERT INTO classes VALUES(1,2,'gaokao'); INSERT INTO class_students VALUES(1,1);
`);
const DB = { prepare(sql) {
 const statement = { get: (...args) => db.prepare(sql).get(...args), all: (...args) => db.prepare(sql).all(...args), run: (...args) => db.prepare(sql).run(...args) };
 const wrapper = args => ({ bind(...values){return wrapper(values)}, async first(){return statement.get(...args) || null}, async all(){return {results:statement.all(...args)}}, _run(){const result=statement.run(...args);return {meta:{last_row_id:Number(result.lastInsertRowid),changes:Number(result.changes)}}},async run(){return this._run()} });
 return wrapper([]);
},async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(statement._run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}};
const env={DB};
const request=(user,method='GET',body)=>new Request('https://test.local/api/test',{method,headers:{cookie:`mb_sid=${user}`,'x-csrf-token':'csrf','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const content1={prompt:'Weighted question',options:['A','B'],answer:'A',explanation:'hidden',notes:[{midi:60,dur:1}],keySignature:'C',meter:'4/4'};
const content2={prompt:'Multiple',options:['B','C','D'],answer:['B','C']};
for(const [id,type,content] of [[1,'single_choice',content1],[2,'multi_choice',content2]]) db.prepare('INSERT INTO questions(id,system_code,status,question_type,content) VALUES(?,\'gaokao\',\'published\',?,?)').run(id,type,JSON.stringify(content));
// Initialize actual collaboration schema using authenticated detail request.
await detail({request:request('student'),env,params:{system:'gaokao',id:999}});
const sections=[{title:'Paper',questions:[{questionId:1,score:2},{questionId:2,score:8}]}];
db.prepare('INSERT INTO question_sets(id,system_code,teacher_id,title,sections_json) VALUES(1,\'gaokao\',2,\'Set\',?)').run(JSON.stringify(sections));
let response=await publish({request:request('teacher','POST',{title:'Homework',questionSetId:1,allowRetry:true,maxAttempts:3,announceInChat:false}),env,params:{system:'gaokao',classId:1}});
assert.equal(response.status,200,await response.clone().text()); const {id}=await response.json();
db.prepare('UPDATE question_sets SET sections_json=? WHERE id=1').run(JSON.stringify([{questions:[{questionId:1,score:8},{questionId:2,score:2}]}]));
response=await detail({request:request('student'),env,params:{system:'gaokao',id}});
let data=await response.json();assert.equal(data.questions[0].content.answer,undefined);assert.equal(data.questions[0].content.explanation,undefined);assert.deepEqual(data.questions[0].content.notes,content1.notes);assert.equal(data.questions[1].question_type,'multi_choice');
response=await submit({request:request('student','POST',{answers:{1:'A'}}),env,params:{system:'gaokao',id}});
assert.equal(response.status,200,await response.clone().text());data=await response.json();assert.equal(data.score,20,'published score snapshot is immutable');
response=await submit({request:request('student','POST',{answers:{2:['C','B']}}),env,params:{system:'gaokao',id}});data=await response.json();assert.equal(data.score,80);
response=await detail({request:new Request(`https://test.local/?review=1`,{headers:{cookie:'mb_sid=student'}}),env,params:{system:'gaokao',id}});data=await response.json();assert.deepEqual(data.questions[1].answer,['C','B']);assert.equal(data.questions[1].correct,true);
response=await submit({request:request('student','POST',{answers:{}}),env,params:{system:'hobby',id}});assert.equal(response.status,404);
response=await submit({request:request('','POST',{answers:{}}),env,params:{system:'gaokao',id}});assert.equal(response.status,401);
db.prepare('UPDATE questions SET content=? WHERE id=1').run(JSON.stringify({prompt:'Missing answer'}));
response=await detail({request:request('student'),env,params:{system:'gaokao',id}});data=await response.json();assert.equal(data.questions[0].content.prompt,content1.prompt);assert.equal(data.assignment.versioned,true);
db.exec("INSERT INTO users VALUES(3,'pending','p@test','Pending','learner','gaokao','active');INSERT INTO class_students VALUES(1,3);");
response=await teacherResults({request:request('teacher'),env,params:{system:'gaokao',id}});assert.equal(response.status,200);data=await response.json();assert.deepEqual(data.questions[1].answer,['B','C']);assert.equal(data.items[0].detail[1].ok,true,'teacher result uses typed snapshot answer');assert.deepEqual(data.questions[0].stats,{submitted:1,correct:0,wrong:1,unanswered:1,accuracy:0});assert.deepEqual(data.questions[1].stats,{submitted:1,correct:1,wrong:0,unanswered:0,accuracy:100});assert.equal(data.summary.pending,1);assert.equal(data.items[1].detail,null,'unsubmitted students must not count as wrong');
// Deliberately damage the stored snapshot to exercise missing-standard rejection.
db.prepare('UPDATE assignment_question_snapshots SET content=? WHERE assignment_id=? AND question_id=1').run(JSON.stringify({prompt:'Missing answer'}),id);
response=await submit({request:request('student','POST',{answers:{}}),env,params:{system:'gaokao',id}});assert.equal(response.status,422);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM homework_attempts').get().n,2);
response=await publish({request:request('teacher','POST',{title:'Invalid',questionIds:[1],announceInChat:false}),env,params:{system:'gaokao',classId:1}});assert.equal(response.status,400);
db.prepare('DELETE FROM assignment_question_snapshots WHERE assignment_id=? AND question_id=2').run(id);
response=await detail({request:request('student'),env,params:{system:'gaokao',id}});assert.equal(response.status,500);assert((await response.json()).error.includes('快照不完整'),'partial snapshot must never fall back to edited live questions');
console.log('PASS real SQLite API integration: publication, immutable weights, hidden answers, music data, array submission/review, auth, system isolation, immutable question content, typed teacher results, invalid standards without writes');

const musicContent={prompt:'听辨音组',options:['D5-C5-B4','C5-D5-E5'],answer:'D5-C5-B4',audioScript:'钢琴等力度弹奏：D5-C5-B4。建议先给A4标准音，再播放3遍。'};
db.prepare("INSERT INTO questions(id,system_code,status,question_type,content,subject) VALUES(4,'gaokao','published','single_choice',?,'dictation')").run(JSON.stringify(musicContent));
response=await publish({request:request('teacher','POST',{title:'Listening',subject:'dictation',questionIds:[4],announceInChat:false}),env,params:{system:'gaokao',classId:1}});assert.equal(response.status,200,await response.clone().text());const musicId=(await response.json()).id;
response=await detail({request:request('student'),env,params:{system:'gaokao',id:musicId}});data=await response.json();assert.equal(data.assignment.subject,'dictation');assert.equal(data.questions[0].content.audioScript,undefined);assert.equal(data.questions[0].content.listenOnly,true);assert.deepEqual(data.questions[0].content.notes.map(n=>n.midi),[74,72,71]);assert.equal(data.questions[0].content.audioSettings.playCount,3);
const badMusic={...musicContent,prompt:'1小节4/4节奏',audioScript:'节拍器预备1小节后，以♩=72击读：ti-ti｜tika-tika｜ta；播放3遍。'};
db.prepare("INSERT INTO questions(id,system_code,status,question_type,content,subject) VALUES(5,'gaokao','published','single_choice',?,'dictation')").run(JSON.stringify(badMusic));
response=await publish({request:request('teacher','POST',{title:'Invalid rhythm',subject:'dictation',questionIds:[5],announceInChat:false}),env,params:{system:'gaokao',classId:1}});assert.equal(response.status,400);assert.match((await response.json()).error,/3拍/);
db.prepare("INSERT INTO questions(id,system_code,status,question_type,content) VALUES(6,'gaokao','published','multi_choice',?)").run(JSON.stringify({prompt:'Legacy multiple',options:['A','B','C'],answer:'A|B'}));
response=await publish({request:request('teacher','POST',{title:'Legacy multiple',questionIds:[6],announceInChat:false}),env,params:{system:'gaokao',classId:1}});assert.equal(response.status,200);const legacyId=(await response.json()).id;
response=await submit({request:request('student','POST',{answers:{6:['B','A']}}),env,params:{system:'gaokao',id:legacyId}});assert.equal((await response.json()).score,100);
console.log('PASS audible listening publication, hidden script, invalid rhythm blocked and legacy multi-select grading');
db.prepare("INSERT INTO questions(id,system_code,status,question_type,content) VALUES(7,'gaokao','published','single_choice',?)").run(JSON.stringify({prompt:'无正确选项',options:['A','B'],answer:'C'}));
const beforeInvalid=db.prepare('SELECT COUNT(*) AS n FROM homework_assignments').get().n;
response=await publish({request:request('teacher','POST',{title:'Cannot answer',questionIds:[7],announceInChat:false}),env,params:{system:'gaokao',classId:1}});assert.equal(response.status,400);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM homework_assignments').get().n,beforeInvalid);

// A legacy assignment can already contain an impossible choice; do not write a grade.
db.prepare("INSERT INTO homework_assignments(class_id,teacher_id,title,subject,question_ids) VALUES(1,2,'Legacy invalid','theory','[7]')").run();
const legacyInvalid=db.prepare('SELECT MAX(id) AS id FROM homework_assignments').get().id;
response=await detail({request:request('student'),env,params:{system:'gaokao',id:legacyInvalid}});data=await response.json();assert.equal(data.assignment.can_submit,false);assert.match(data.assignment.issue,/选项无效/);
const attemptsBefore=db.prepare('SELECT COUNT(*) AS n FROM homework_attempts').get().n;
response=await submit({request:request('student','POST',{answers:{7:'C'}}),env,params:{system:'gaokao',id:legacyInvalid}});assert.equal(response.status,422);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM homework_attempts').get().n,attemptsBefore);

response=await publish({request:request('teacher','POST',{title:'Concurrent submit',questionIds:[6],allowRetry:false,announceInChat:false}),env,params:{system:'gaokao',classId:1}});assert.equal(response.status,200);const concurrentId=(await response.json()).id;
const concurrent=await Promise.all([submit({request:request('student','POST',{answers:{6:['A','B']}}),env,params:{system:'gaokao',id:concurrentId}}),submit({request:request('student','POST',{answers:{6:['A']}}),env,params:{system:'gaokao',id:concurrentId}})]);
assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM homework_attempts WHERE assignment_id=?').get(concurrentId).n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM homework_submissions WHERE assignment_id=?').get(concurrentId).n,1);
const concurrentBest=db.prepare('SELECT score FROM homework_submissions WHERE assignment_id=?').get(concurrentId).score;
db.prepare('UPDATE assignment_settings SET allow_retry=1,max_attempts=2 WHERE assignment_id=?').run(concurrentId);
response=await submit({request:request('student','POST',{answers:{6:['A']}}),env,params:{system:'gaokao',id:concurrentId}});assert.equal(response.status,200);assert.equal((await response.json()).bestScore,concurrentBest);assert.equal(db.prepare('SELECT score FROM homework_submissions WHERE assignment_id=?').get(concurrentId).score,concurrentBest);
