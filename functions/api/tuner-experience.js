import {json} from './shared.js';
export const EXPERIENCE_VALUES = {
  platform: ['ios','android','desktop','other'], browser: ['safari','chrome','firefox','edge','other'],
  instrument: ['guitar','erhu'], result: ['stable','no_stable','input_failed','cancelled'],
  failure: ['none','permission','no_device','device_busy','unsupported','unknown']
};
export async function ensureExperience(env) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS tuner_experience_counts(day TEXT NOT NULL,platform TEXT NOT NULL,browser TEXT NOT NULL,instrument TEXT NOT NULL,result TEXT NOT NULL,failure TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,platform,browser,instrument,result,failure))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS tuner_experience_budget(day TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0)')
  ]);
}
export async function onRequestPost({request,env}) {
  if(!env.DB)return json({ok:false,error:'统计服务暂时不可用。'},503);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({ok:false},403);
  if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return json({ok:false},415);
  const reader=request.body?.getReader();if(!reader)return json({ok:false},400);
  let size=0,text='';const decoder=new TextDecoder();let body;
  try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return json({ok:false},413)}text+=decoder.decode(value,{stream:true})}body=JSON.parse(text+decoder.decode())}catch(_){return json({ok:false},400)}
  if(!body||typeof body!=='object'||Array.isArray(body)||body.consent!==true||Object.keys(body).some(key=>key!=='consent'&&!Object.hasOwn(EXPERIENCE_VALUES,key)))return json({ok:false},400);
  if(Object.entries(EXPERIENCE_VALUES).some(([key,values])=>!values.includes(body[key])))return json({ok:false},400);
  if((body.result==='input_failed')===(body.failure==='none'))return json({ok:false},400);
  await ensureExperience(env);
  const day=new Date().toISOString().slice(0,10),keepFrom=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  const configured=Number(env.TUNER_STATS_DAILY_LIMIT),limit=Number.isInteger(configured)&&configured>=1&&configured<=100000?configured:10000;
  const admitted=await env.DB.prepare('INSERT INTO tuner_experience_budget(day,count) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(day,limit).first();
  if(!admitted)return json({ok:false},429);
  await env.DB.batch([env.DB.prepare('DELETE FROM tuner_experience_counts WHERE day<?').bind(keepFrom),env.DB.prepare('DELETE FROM tuner_experience_budget WHERE day<?').bind(keepFrom)]);
  await env.DB.prepare('INSERT INTO tuner_experience_counts(day,platform,browser,instrument,result,failure,count) VALUES(?,?,?,?,?,?,1) ON CONFLICT(day,platform,browser,instrument,result,failure) DO UPDATE SET count=count+1').bind(day,body.platform,body.browser,body.instrument,body.result,body.failure).run();
  return json({ok:true});
}
