export async function ensureTuning(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS tuning_lessons (token TEXT PRIMARY KEY,class_id INTEGER NOT NULL,title TEXT NOT NULL,instrument TEXT NOT NULL,targets_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS tuning_submissions (lesson_token TEXT NOT NULL,student_id INTEGER NOT NULL,summary_json TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(lesson_token,student_id),FOREIGN KEY(lesson_token) REFERENCES tuning_lessons(token) ON DELETE CASCADE,FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE)")
  ]);
}
export function parseTargets(value) {
  if (!Array.isArray(value) || !value.length || value.length > 12) return null;
  const notes = value.map(item => {
    const match = String(item).trim().match(/^([A-Ga-g])([#b♯♭]?)([2-6])$/); if (!match) return null;
    const letter=match[1].toUpperCase(), accidental=match[2].replace('♯','#').replace('♭','b');
    const midi=(Number(match[3])+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[letter]+(accidental==='#'?1:accidental==='b'?-1:0);
    return midi>=36 && midi<=84 ? letter+accidental+match[3] : null;
  });
  return notes.every(Boolean) && new Set(notes).size === notes.length ? notes : null;
}
export function validateSummary(input, targets) {
  if (!Array.isArray(input) || input.length !== targets.length) return null;
  const byNote=new Map(input.map(item=>[item?.note,item]));if(byNote.size!==targets.length)return null;
  const summary=[];
  for (const note of targets) {
    const item=byNote.get(note);if(!item)return null;
    const {samples,stableCount,lowCount,highCount,meanCents}=item;
    if(![samples,stableCount,lowCount,highCount].every(n=>Number.isInteger(n)&&n>=0&&n<=3600))return null;
    if(stableCount>samples||lowCount+highCount>samples||!Number.isFinite(meanCents)||Math.abs(meanCents)>200)return null;
    if(!samples&&(meanCents!==0||stableCount||lowCount||highCount))return null;
    summary.push({note,samples,stableCount,lowCount,highCount,meanCents:Math.round(meanCents*10)/10,complete:samples>=3&&stableCount>0});
  }
  return summary;
}

export async function readTuningBody(request) {
  const reader=request.body?.getReader();if(!reader)return {error:'请填写练习内容。',status:400};
  const decoder=new TextDecoder();let size=0,text='';
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return {error:'练习内容过大。',status:413};}text+=decoder.decode(value,{stream:true});}
    text+=decoder.decode();const body=JSON.parse(text);
    if(!body||typeof body!=='object'||Array.isArray(body))return {error:'练习内容无效。',status:400};
    return {body};
  }catch(_){return {error:'练习内容无效。',status:400};}
}
