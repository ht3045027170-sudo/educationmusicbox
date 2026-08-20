(() => {
  let csrfToken='';
  const dialog=document.createElement('dialog');dialog.className='auth-dialog homework-dialog';document.body.append(dialog);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  async function csrf(){if(csrfToken)return csrfToken;csrfToken=(await(await fetch('/api/csrf')).json()).csrfToken;return csrfToken;}
  async function api(url,options={}){const method=options.method||'GET',headers={...(options.headers||{})};if(!['GET','HEAD'].includes(method))headers['x-csrf-token']=await csrf();const response=await fetch(url,{...options,headers});const body=response.status===204?null:await response.json().catch(()=>({}));if(!response.ok)throw Error(body?.message||body?.error||'请求失败');return body;}
  const systemName=code=>code==='hobby'?'音乐爱好者':'高考音乐生';
  async function list(systemCode){
    try{
      const data=await api(`/api/learning/${systemCode}/assignments`);
      return `<section class="student-system"><h3>${systemName(systemCode)}</h3><form data-join="${systemCode}" class="join-class"><input name="inviteCode" required maxlength="20" placeholder="输入教师提供的班级邀请码"><button>加入班级</button></form>${data.items.map(item=>`<article class="student-homework"><b>${esc(item.title)}</b><p>${esc(item.class_name)} · ${item.question_count} 题${item.due_at?' · '+new Date(item.due_at).toLocaleString()+' 截止':''}</p><button data-open-assignment="${item.id}" data-system="${systemCode}">${item.submitted_at?'查看成绩与错题':'开始作业'}</button>${item.submitted_at?` <span class="badge success">${item.score} 分</span>`:''}</article>`).join('')||'<p>暂无班级作业。</p>'}</section>`;
    }catch(error){return `<section class="student-system"><h3>${systemName(systemCode)}</h3><p>${esc(error.message)}</p></section>`;}
  }
  async function open(){
    dialog.innerHTML=`<div class="auth-card"><button type="button" class="account-close" data-close>×</button><h2>我的班级与作业</h2><div class="student-systems">${await list('hobby')}${await list('gaokao')}</div></div>`;
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.querySelectorAll('[data-join]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const fd=new FormData(form);try{await api(`/api/learning/${form.dataset.join}/classes/join`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inviteCode:fd.get('inviteCode')})});open();}catch(error){alert(error.message);}});
    dialog.querySelectorAll('[data-open-assignment]').forEach(button=>button.onclick=()=>openAssignment(button.dataset.system,button.dataset.openAssignment));
    if(!dialog.open)dialog.showModal();
  }
  function questionInput(question){
    const content=question.content||{},options=Array.isArray(content.options)?content.options:[];
    if(options.length)return `<div class="student-options">${options.map(option=>`<label><input type="radio" name="q${question.question_id}" value="${esc(option)}" ${question.answer===option?'checked':''} ${question.answer!==undefined?'disabled':''}> ${esc(option)}</label>`).join('')}</div>`;
    return `<textarea name="q${question.question_id}" ${question.answer!==undefined?'disabled':''} placeholder="填写答案">${esc(question.answer??'')}</textarea>`;
  }
  async function openAssignment(systemCode,id){
    const data=await api(`/api/learning/${systemCode}/assignments/${id}`),submitted=Boolean(data.assignment.submitted_at);
    dialog.innerHTML=`<form class="auth-card assignment-paper"><button type="button" class="account-close" data-back>×</button><h2>${esc(data.assignment.title)}</h2><p>${esc(data.assignment.instructions||'完成后统一提交。')}</p>${data.questions.map((question,index)=>`<section class="student-question"><h3>${index+1}. ${esc(question.content.prompt||question.content.question||'题目')}</h3>${questionInput(question)}${submitted?`<p class="${question.correct?'answer-correct':'answer-wrong'}">${question.correct?'回答正确':'回答错误'} · 标准答案：${esc(question.content.answer??question.content.correctAnswer??'')}</p><p>${esc(question.content.explanation||question.content.analysis||'')}</p>`:''}</section>`).join('')}${submitted?`<div class="score-card">本次成绩：${data.assignment.score} 分</div>`:'<button class="submit">提交整份作业</button><p class="auth-message"></p>'}</form>`;
    dialog.querySelector('[data-back]').onclick=open;
    if(!submitted)dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const fd=new FormData(event.currentTarget),answers={};data.questions.forEach(question=>answers[question.question_id]=fd.get(`q${question.question_id}`)??'');try{await api(`/api/learning/${systemCode}/assignments/${id}/submit`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({answers})});openAssignment(systemCode,id);}catch(error){event.currentTarget.querySelector('.auth-message').textContent=error.message;}};
  }
  const style=document.createElement('style');style.textContent=`.homework-dialog{width:min(820px,calc(100% - 24px))}.student-systems{display:grid;grid-template-columns:1fr 1fr;gap:14px}.student-system,.student-question{border:1px solid #dce5df;border-radius:14px;padding:14px;margin:10px 0}.join-class{display:flex;gap:7px}.join-class input,.student-question textarea{width:100%;padding:10px;border:1px solid #cad8d0;border-radius:9px}.student-homework{border-top:1px solid #eef2ef;padding:12px 0}.student-homework p{margin:5px 0}.student-options{display:grid;gap:7px}.assignment-paper{max-height:calc(100dvh - 28px);overflow:auto}.answer-correct{color:#28723e}.answer-wrong{color:#b44444}.score-card{font-size:24px;font-weight:700;color:#28723e;margin-top:18px}@media(max-width:700px){.student-systems{grid-template-columns:1fr}.join-class{display:grid}}`;document.head.append(style);
  window.MusicHomework={open};
})();
