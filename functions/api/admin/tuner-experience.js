import {json,currentUser} from '../shared.js';
import {ensureExperience} from '../tuner-experience.js';
export async function onRequestGet({request,env}) {
  if(!env.DB)return json({ok:false,error:'统计服务暂时不可用。'},503);
  const user=await currentUser(request,env);if(!user||user.role!=='admin')return json({ok:false,error:'仅服务器管理员可以查看体验统计。'},403);
  await ensureExperience(env);
  const since=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  await env.DB.batch([env.DB.prepare('DELETE FROM tuner_experience_counts WHERE day<?').bind(since),env.DB.prepare('DELETE FROM tuner_experience_budget WHERE day<?').bind(since)]);
  const {results:items}=await env.DB.prepare('SELECT day,platform,browser,instrument,result,failure,count FROM tuner_experience_counts WHERE day>=? ORDER BY day DESC,count DESC').bind(since).all();
  return json({items,description:'自愿参与的调音尝试次数，非用户人数。稳定结果为设备检测摘要；不能代表所有设备的真实精度。'});
}
