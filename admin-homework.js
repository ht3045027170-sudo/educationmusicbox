(() => {
  const nav = document.querySelector('nav'), logout = document.getElementById('logout');
  const tab = document.createElement('button'); tab.dataset.tab = 'teaching'; tab.textContent = '教师中心'; tab.hidden = true; nav.insertBefore(tab, logout);
  const section = document.createElement('section'); section.id = 'teaching'; section.className = 'card tab'; section.hidden = true;
  section.innerHTML = `<div class="teach-toolbar"><select id="teachSystem"></select><input id="className" maxlength="80" placeholder="新班级名称"><button id="createClass">创建班级</button></div><div class="teacher-grid"><div><h2>我的班级</h2><div id="classList"></div></div><div id="classDetail"><p>选择一个班级查看学生并布置作业。</p></div></div>`;
  document.getElementById('dashboard').append(section);
  const style = document.createElement('style'); style.textContent = `.teach-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.teach-toolbar input,.teach-toolbar select,.assignment-builder input,.assignment-builder select,.assignment-builder textarea{padding:9px;border:1px solid #cad8d0;border-radius:9px}.teacher-grid{display:grid;grid-template-columns:300px 1fr;gap:20px}.class-card,.teacher-panel{border:1px solid #dce5df;border-radius:13px;padding:13px;margin-bottom:9px}.class-card.active{border-color:#4d9b73;background:#f2faf5}.class-meta{font-size:12px;color:#718078}.assignment-builder{display:grid;gap:9px;margin-top:14px}.question-picker{max-height:260px;overflow:auto;border:1px solid #dce5df;border-radius:10px;padding:8px}.question-picker label{display:block;padding:7px;border-bottom:1px solid #eef2ef}.result-table{margin-top:10px}.class-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.class-actions button,.small{padding:5px 10px;font-size:12px}.badge-x{border:0;background:transparent;color:inherit;font-size:14px;line-height:1;cursor:pointer;padding:0 0 0 3px;opacity:.6}.badge-x:hover{opacity:1}.q-summary{border:1px dashed #cad8d0;border-radius:10px;padding:10px;margin:10px 0;font-size:13px}.q-line{padding:4px 0;border-bottom:1px solid #eef2ef}.q-ans{color:#28723e;margin-left:8px}.detail-ok{color:#28723e;font-size:12px}.detail-wrong{color:#c55757;font-size:12px}@media(max-width:760px){.teacher-grid{grid-template-columns:1fr}}`; document.head.append(style);
  const systemSelect = section.querySelector('#teachSystem'), classList = section.querySelector('#classList'), detail = section.querySelector('#classDetail');
  let csrfToken = '', selectedClass = null;
  async function csrf(){ if(csrfToken)return csrfToken; csrfToken=(await(await fetch('/api/csrf')).json()).csrfToken; return csrfToken; }
  async function api(url,options={}){const method=options.method||'GET',headers={...(options.headers||{})};if(!['GET','HEAD'].includes(method))headers['x-csrf-token']=await csrf();const r=await fetch(url,{...options,headers});const body=r.status===204?null:await r.json().catch(()=>({}));if(!r.ok)throw Error(body?.message||body?.error||'请求失败');return body;}
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const name = code => code === 'hobby' ? '音乐爱好者' : '高考音乐生';
  async function loadClasses(){
    const data = await api(`/api/teaching/${systemSelect.value}/classes`);
    classList.innerHTML = data.items.map(item => `<article class="class-card ${selectedClass===item.id?'active':''}" data-class="${item.id}"><b>${esc(item.name)}</b><div class="class-meta">邀请码 ${item.invite_code} · ${item.student_count} 名学生 · ${item.assignment_count} 份作业</div><div class="class-actions"><button class="ghost small" data-copy-code="${esc(item.invite_code)}">复制邀请码</button><button class="danger small" data-del-class="${item.id}">删除班级</button></div></article>`).join('') || '<p>尚未创建班级。</p>';
    if (selectedClass && !data.items.some(item => item.id === selectedClass)) { selectedClass = null; detail.innerHTML = '<p>选择一个班级查看详情。</p>'; }
  }
  async function openClass(id){
    selectedClass = Number(id); await loadClasses();
    const [students, assignments, questions] = await Promise.all([
      api(`/api/teaching/${systemSelect.value}/classes/${selectedClass}/students`),
      api(`/api/teaching/${systemSelect.value}/classes/${selectedClass}/assignments`),
      api(`/api/teaching/${systemSelect.value}/questions`)
    ]);
    const subjects = systemSelect.value === 'hobby' ? '<option value="theory">吉他乐理</option>' : '<option value="theory">乐理</option><option value="dictation">听写</option><option value="sight_singing">视唱</option>';
    detail.innerHTML = `<section class="teacher-panel"><h2>班级学生</h2>${students.items.map(item=>`<span class="badge success">${esc(item.username)}<button class="badge-x" data-remove-student="${item.user_id}" title="移出班级">×</button></span>`).join(' ')||'<p>把班级邀请码发给学生即可加入。</p>'}</section><section class="teacher-panel"><h2>布置已审核题目</h2><form class="assignment-builder"><input name="title" required maxlength="100" placeholder="作业标题"><textarea name="instructions" maxlength="1000" placeholder="作业说明"></textarea><select name="subject">${subjects}</select><input name="dueAt" type="datetime-local"><div class="question-picker"></div><button>发布作业</button><p class="error"></p></form></section><section class="teacher-panel"><h2>已发布作业</h2><div class="assignment-list">${assignments.items.map(item=>`<article class="class-card"><b>${esc(item.title)}</b><div class="class-meta">${item.question_count} 题 · 已提交 ${item.submission_count} · 平均分 ${item.average_score ?? '—'}</div><div class="class-actions"><button data-results="${item.id}">查看成绩</button><button class="danger small" data-del-assignment="${item.id}">删除作业</button></div><div data-result-box="${item.id}"></div></article>`).join('')||'<p>暂无作业。</p>'}</div></section>`;
    const form = detail.querySelector('form'), picker = form.querySelector('.question-picker');
    function renderQuestions(){ const subject=form.elements.subject.value; picker.innerHTML=questions.items.filter(q=>q.subject===subject).map(q=>`<label><input type="checkbox" name="question" value="${q.id}"> ${esc(q.content.prompt||q.content.question||q.knowledge_id)}</label>`).join('')||'该科目暂无已发布题目。'; }
    form.elements.subject.onchange=renderQuestions; renderQuestions();
    form.onsubmit=async event=>{event.preventDefault();const fd=new FormData(form),message=form.querySelector('.error');try{await api(`/api/teaching/${systemSelect.value}/classes/${selectedClass}/assignments`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:fd.get('title'),instructions:fd.get('instructions'),subject:fd.get('subject'),dueAt:fd.get('dueAt')?new Date(fd.get('dueAt')).toISOString():null,questionIds:fd.getAll('question').map(Number)})});message.style.color='#28723e';message.textContent='作业已发布';openClass(selectedClass);}catch(error){message.style.color='';message.textContent=error.message;}};
  }
  classList.onclick = async event => {
    const del = event.target.dataset.delClass, copy = event.target.dataset.copyCode;
    if (del) { if (!confirm('删除班级将同时清空该班的学生名单、全部作业与提交记录，且不可恢复。确定删除？')) return;
      try { await api(`/api/teaching/${systemSelect.value}/classes/${del}`, { method: 'DELETE' }); if (selectedClass === Number(del)) { selectedClass = null; detail.innerHTML = '<p>选择一个班级查看详情。</p>'; } loadClasses(); } catch (error) { alert(error.message); } return; }
    if (copy) { try { await navigator.clipboard.writeText(copy); event.target.textContent = '已复制'; setTimeout(() => event.target.textContent = '复制邀请码', 900); } catch { prompt('手动复制邀请码：', copy); } return; }
    const card=event.target.closest('[data-class]'); if(card) openClass(card.dataset.class);
  };
  detail.onclick = async event => {
    const remove = event.target.dataset.removeStudent, delA = event.target.dataset.delAssignment;
    if (remove) { if (!confirm('确定把该学生移出班级？其提交过的作业记录也会一并删除。')) return;
      try { await api(`/api/teaching/${systemSelect.value}/classes/${selectedClass}/students/${remove}`, { method: 'DELETE' }); openClass(selectedClass); } catch (error) { alert(error.message); } return; }
    if (delA) { if (!confirm('删除作业会连同全部学生的提交记录一起删除，且不可恢复。确定删除？')) return;
      try { await api(`/api/teaching/${systemSelect.value}/assignments/${delA}`, { method: 'DELETE' }); openClass(selectedClass); } catch (error) { alert(error.message); } return; }
    const id=event.target.dataset.results;if(!id)return;
    const data=await api(`/api/teaching/${systemSelect.value}/assignments/${id}/results`);
    const qlist = (data.questions||[]).map((q,i)=>`<div class="q-line"><b>第${i+1}题</b> ${esc(q.prompt)}<span class="q-ans">答案：${esc(q.answer)}</span></div>`).join('');
    detail.querySelector(`[data-result-box="${id}"]`).innerHTML=`${qlist?`<div class="q-summary"><b>题目与标准答案</b>${qlist}</div>`:''}<table class="result-table"><thead><tr><th>学生</th><th>成绩</th><th>错题</th><th>提交时间</th><th>逐题明细</th></tr></thead><tbody>${data.items.map(x=>`<tr><td>${esc(x.username)}</td><td>${x.score??'未提交'}</td><td>${x.wrong_count??'—'}</td><td>${x.submitted_at?new Date(x.submitted_at).toLocaleString():'—'}</td><td>${x.detail?x.detail.map((d,i)=>`<div class="${d.ok?'detail-ok':'detail-wrong'}">第${i+1}题 ${d.ok?'✓':`✗ 答的是「${esc(d.given||'空')}」`}</div>`).join(''):'—'}</td></tr>`).join('')}</tbody></table>`;
  };
  section.querySelector('#createClass').onclick=async()=>{const input=section.querySelector('#className');if(!input.value.trim())return;await api(`/api/teaching/${systemSelect.value}/classes`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:input.value})});input.value='';loadClasses();};
  systemSelect.onchange=()=>{selectedClass=null;detail.innerHTML='<p>选择一个班级查看详情。</p>';loadClasses();};
  tab.onclick=loadClasses;
  const ready=()=>{const manager=window.CONTENT_MANAGER;if(!manager)return setTimeout(ready,50);if(manager.platform)return;tab.hidden=false;systemSelect.innerHTML=manager.systems.map(item=>`<option value="${item.system_code}">${name(item.system_code)}</option>`).join('');};ready();
})();
