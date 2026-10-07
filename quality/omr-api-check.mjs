import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost, MAX_BODY_BYTES } from '../functions/api/omr/recognize.js';
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE users(id INTEGER,username TEXT,email TEXT,display_name TEXT,role TEXT,learning_system TEXT,status TEXT); CREATE TABLE sessions(token TEXT,user_id INTEGER,expires_at TEXT,csrf TEXT); INSERT INTO users VALUES(1,'s','s@test','S','learner','gaokao','active'); INSERT INTO sessions VALUES('session',1,'2099-01-01','csrf');`);
const DB={prepare(sql){const make=args=>({bind(...values){return make(values)},async first(){return db.prepare(sql).get(...args)||null},async run(){return db.prepare(sql).run(...args)}});return make([])}};
const env={DB,OMR_SERVICE_URL:'https://omr.example.test',OMR_SERVICE_TOKEN:'secret',OMR_DAILY_LIMIT:2,OMR_TIMEOUT_MS:100};
const body=JSON.stringify({imageDataUrl:'data:image/png;base64,YQ=='});
const req=(headers={},data=body)=>new Request('https://test.local/api/omr/recognize',{method:'POST',headers:{cookie:'mb_sid=session','x-csrf-token':'csrf',...headers},body:data,duplex:'half'});
let calls=0;const original=globalThis.fetch;
globalThis.fetch=async()=>{calls++;return Response.json({ok:true,result:{notes:[]}})};
try {
 assert.equal((await onRequestPost({request:req({cookie:''}),env})).status,401);
 assert.equal((await onRequestPost({request:req({'x-csrf-token':'bad'}),env})).status,403);
 assert.equal((await onRequestPost({request:req({},'{}'),env})).status,400);
 // No Content-Length: actual streaming limit is still enforced before upstream.
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_BODY_BYTES));c.enqueue(new Uint8Array(1));c.close()}});
 assert.equal((await onRequestPost({request:req({},stream),env})).status,413);assert.equal(calls,0);
 const concurrent=await Promise.all([1,2,3].map(()=>onRequestPost({request:req(),env})));
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,200,429]);assert.equal(calls,2);
 db.exec('DELETE FROM omr_daily_usage');
 globalThis.fetch=async()=>new Response('private service detail',{status:500});
 const failed=await onRequestPost({request:req(),env});assert.equal(failed.status,502);assert(!(await failed.text()).includes('private service detail'));
 globalThis.fetch=async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));
 assert.equal((await onRequestPost({request:req(),env})).status,504);
 console.log('PASS OMR login, CSRF, invalid input, actual streamed size, atomic concurrent quota, upstream failure sanitization and timeout');
} finally {globalThis.fetch=original;db.close()}
