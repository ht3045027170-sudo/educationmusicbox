(() => {
  'use strict';
  let csrfToken = '', refreshTimer = 0, selectedSystem = 'gaokao', selectedClass = null;
  const dialog = document.createElement('dialog');
  dialog.className = 'class-dialog';
  document.body.append(dialog);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const isTeacher = () => window.CONTENT_MANAGER?.role === 'teacher' || window.HetianAuth?.getUser?.()?.role === 'teacher';
  const teacherLabel = value => /老师$/.test(String(value || '')) ? String(value) : `${value || '教师'}老师`;

  async function csrf() {
    if (csrfToken) return csrfToken;
    csrfToken = (await (await fetch('/api/csrf', { credentials:'same-origin' })).json()).csrfToken;
    return csrfToken;
  }
  async function api(url, options = {}) {
    const method = options.method || 'GET', headers = { ...(options.headers || {}) };
    if (!['GET', 'HEAD'].includes(method)) headers['x-csrf-token'] = await csrf();
    const response = await fetch(url, { ...options, headers, credentials:'same-origin' });
    const body = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || body?.error || '请求失败');
    return body;
  }

  const chatShell = classes => `<div class="class-shell">
    <aside class="class-rail"><div class="class-rail-head"><b>学生班级</b><button type="button" data-close aria-label="关闭">×</button></div>
      <div class="class-list">${classes.map(item => `<button type="button" data-class="${item.id}" class="${item.id === selectedClass ? 'active' : ''}"><span>${esc(item.name.slice(0, 1))}</span><div><b>${esc(item.name)}</b><small>${esc(teacherLabel(item.teacher_name || item.teacher_username))}</small></div></button>`).join('') || '<p>尚未加入班级</p>'}</div>
      ${isTeacher() ? '' : `<form class="class-join"><input name="inviteCode" maxlength="20" placeholder="班级邀请码" required><button>加入</button></form>`}
    </aside>
    <main class="class-main"><div id="classConversation" class="class-empty">${classes.length ? '选择一个班级进入群聊' : '输入老师提供的邀请码加入班级'}</div></main>
  </div>`;

  async function open(systemCode = 'gaokao', initialClassId = null) {
    selectedSystem = systemCode;
    clearInterval(refreshTimer);
    try {
      const data = await api(`/api/learning/${systemCode}/classes`);
      const requestedClass = Number(initialClassId) || selectedClass;
      selectedClass = data.items.some(item => item.id === requestedClass) ? requestedClass : (data.items[0]?.id || null);
      dialog.innerHTML = chatShell(data.items);
      dialog.querySelector('[data-close]').onclick = () => dialog.close();
      dialog.querySelectorAll('[data-class]').forEach(button => button.onclick = () => openClass(Number(button.dataset.class)));
      dialog.querySelector('.class-join')?.addEventListener('submit', async event => {
        event.preventDefault();
        const inviteCode = new FormData(event.currentTarget).get('inviteCode');
        try {
          await api(`/api/learning/${selectedSystem}/classes/join`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ inviteCode }) });
          selectedClass = null;
          open(selectedSystem);
        } catch (error) { alert(error.message); }
      });
      if (!dialog.open) dialog.showModal();
      if (selectedClass) await openClass(selectedClass);
      refreshTimer = setInterval(() => {
        const composer = dialog.querySelector('.message-compose textarea');
        if (selectedClass && document.activeElement !== composer) loadConversation(false).catch(() => {});
      }, 5000);
    } catch (error) {
      dialog.innerHTML = `<div class="class-error"><button type="button" data-close>×</button><h2>学生班级</h2><p>${esc(error.message)}</p></div>`;
      dialog.querySelector('[data-close]').onclick = () => dialog.close();
      if (!dialog.open) dialog.showModal();
    }
  }

  async function openClass(classId) {
    selectedClass = classId;
    dialog.querySelectorAll('[data-class]').forEach(button => button.classList.toggle('active', Number(button.dataset.class) === classId));
    await loadConversation(true);
  }

  function assignmentCard(item) {
    const submitted = Boolean(item.submitted_at);
    return `<article class="class-homework"><i>作业</i><div><b>${esc(item.title)}</b><small>${item.question_count} 题${item.due_at ? ` · ${new Date(item.due_at).toLocaleString()} 截止` : ''}</small></div>${isTeacher() ? '<em>已发布</em>' : `<button type="button" data-assignment="${item.id}">${submitted ? `${item.score} 分 · 查看错题` : '开始作业'}</button>`}</article>`;
  }

  async function loadConversation(scrollToEnd) {
    const target = dialog.querySelector('#classConversation');
    if (!target || !selectedClass) return;
    const oldStream = target.querySelector('.message-stream');
    const oldScrollTop = oldStream?.scrollTop || 0;
    const wasNearBottom = !oldStream || oldStream.scrollHeight - oldStream.scrollTop - oldStream.clientHeight < 80;
    const [messages, assignments] = await Promise.all([
      api(`/api/learning/${selectedSystem}/classes/${selectedClass}/messages`),
      api(`/api/learning/${selectedSystem}/assignments`)
    ]);
    const classAssignments = assignments.items.filter(item => Number(item.class_id) === Number(selectedClass));
    const localDay = value => value ? new Date(value.endsWith?.('Z') ? value : `${value}Z`).toLocaleDateString() : '';
    const todayKey = new Date().toLocaleDateString();
    const today = classAssignments.filter(item => !item.submitted_at && localDay(item.created_at) === todayKey).slice(0, 4);
    target.className = 'class-conversation';
    target.innerHTML = `<header class="conversation-head"><div><b>${esc(messages.class.name)}</b><small>${messages.items.length} 条班级消息</small></div><button type="button" data-refresh>刷新</button></header>
      <section class="today-homework"><h3>今日作业</h3>${today.map(assignmentCard).join('') || '<p>今天没有新作业。</p>'}</section>
      <section class="message-stream">${messages.items.map(message => message.kind === 'assignment'
        ? `<div class="message-system"><small>老师发布了新作业</small>${assignmentCard(classAssignments.find(item => item.id === message.assignment_id) || { id:message.assignment_id, title:message.content, question_count:0 })}</div>`
        : `<article class="message-row ${message.is_mine ? 'mine' : 'other'}"><div class="message-avatar">${esc((message.display_name || message.username || '同').slice(0, 1))}</div><div><small>${esc(message.display_name || message.username || '班级成员')}${message.role === 'teacher' ? ' · 教师' : ''}</small><p>${esc(message.content)}</p><time>${new Date(message.created_at + 'Z').toLocaleString()}</time></div></article>`).join('') || '<div class="message-welcome">班级已经建立，说一句“大家好”吧。</div>'}</section>
      <form class="message-compose"><textarea name="content" maxlength="1000" rows="1" placeholder="发送班级消息" required></textarea><button>发送</button></form>`;
    target.querySelector('[data-refresh]').onclick = () => loadConversation(false);
    target.querySelectorAll('[data-assignment]').forEach(button => button.onclick = () => openAssignment(selectedSystem, button.dataset.assignment));
    target.querySelector('.message-compose').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget, button = form.querySelector('button');
      const content = new FormData(form).get('content');
      button.disabled = true;
      try {
        await api(`/api/learning/${selectedSystem}/classes/${selectedClass}/messages`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ content }) });
        await loadConversation(true);
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    };
    const stream = target.querySelector('.message-stream');
    if (scrollToEnd || wasNearBottom) stream.scrollTop = stream.scrollHeight;
    else stream.scrollTop = oldScrollTop;
  }

  function questionInput(question) {
    const content = question.content || {}, options = Array.isArray(content.options) ? content.options : [];
    if (options.length) return `<div class="student-options">${options.map(option => `<label><input type="radio" name="q${question.question_id}" value="${esc(option)}" ${question.answer === option ? 'checked' : ''} ${question.answer !== undefined ? 'disabled' : ''}> ${esc(option)}</label>`).join('')}</div>`;
    return `<textarea name="q${question.question_id}" ${question.answer !== undefined ? 'disabled' : ''} placeholder="填写答案">${esc(question.answer ?? '')}</textarea>`;
  }

  async function openAssignment(systemCode, id) {
    const data = await api(`/api/learning/${systemCode}/assignments/${id}`), submitted = Boolean(data.assignment.submitted_at);
    dialog.innerHTML = `<form class="assignment-paper"><button type="button" class="assignment-back" data-back>← 返回班级</button><h2>${esc(data.assignment.title)}</h2><p>${esc(data.assignment.instructions || '完成后统一提交。')}</p>${data.questions.map((question, index) => `<section class="student-question"><h3>${index + 1}. ${esc(question.content.prompt || question.content.question || '题目')}</h3>${questionInput(question)}${submitted ? `<p class="${question.correct ? 'answer-correct' : 'answer-wrong'}">${question.correct ? '回答正确' : '回答错误'} · 标准答案：${esc(question.content.answer ?? '')}</p><p>${esc(question.content.explanation || '')}</p>` : ''}</section>`).join('')}${submitted ? `<div class="score-card">本次成绩：${data.assignment.score} 分</div>` : '<button class="assignment-submit">提交整份作业</button><p class="auth-message"></p>'}</form>`;
    dialog.querySelector('[data-back]').onclick = () => open(selectedSystem, selectedClass);
    if (!submitted) dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget), answers = {};
      data.questions.forEach(question => answers[question.question_id] = fd.get(`q${question.question_id}`) ?? '');
      try {
        await api(`/api/learning/${systemCode}/assignments/${id}/submit`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ answers }) });
        openAssignment(systemCode, id);
      } catch (error) { event.currentTarget.querySelector('.auth-message').textContent = error.message; }
    };
  }

  dialog.addEventListener('close', () => clearInterval(refreshTimer));
  window.addEventListener('hetian:auth-changed', () => {
    csrfToken = '';
    selectedClass = null;
    clearInterval(refreshTimer);
    if (dialog.open) dialog.close();
  });
  const style = document.createElement('style');
  style.textContent = `.class-dialog{width:min(1040px,calc(100% - 24px));height:min(760px,calc(100dvh - 24px));padding:0;border:0;border-radius:22px;overflow:hidden;background:#f3eee7;color:#3d2a23;box-shadow:0 30px 90px rgba(49,24,15,.3)}.class-dialog::backdrop{background:rgba(42,24,17,.5);backdrop-filter:blur(7px)}.class-shell{display:grid;grid-template-columns:280px 1fr;height:100%}.class-rail{display:flex;flex-direction:column;background:#efe7dc;border-right:1px solid #d6c8ba}.class-rail-head,.conversation-head{display:flex;align-items:center;justify-content:space-between;min-height:72px;padding:14px 18px;border-bottom:1px solid #d8cabd}.class-rail-head b{font:700 22px Georgia,"Songti SC",serif}.class-rail-head button{border:0;background:none;font-size:28px;color:#795f53;cursor:pointer}.class-list{flex:1;overflow:auto;padding:9px}.class-list>button{width:100%;display:flex;gap:11px;align-items:center;padding:11px;border:0;border-radius:12px;background:transparent;text-align:left;color:inherit;cursor:pointer}.class-list>button.active{background:#fff8f1}.class-list>button>span,.message-avatar{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border-radius:10px;background:#df6534;color:#fff;font-weight:800}.class-list b,.class-list small{display:block}.class-list small{margin-top:4px;color:#88746a}.class-join{display:flex;gap:7px;padding:12px;border-top:1px solid #d8cabd}.class-join input{min-width:0;flex:1;padding:10px;border:1px solid #cfbfb0;border-radius:9px}.class-join button,.message-compose button,.assignment-submit{border:0;border-radius:9px;background:#df6534;color:#fff;font-weight:800;padding:0 16px}.class-main{min-width:0;height:100%}.class-empty{display:grid;place-items:center;height:100%;color:#8a766b}.conversation-head{background:#fffaf4}.conversation-head small{display:block;margin-top:4px;color:#8a766b}.conversation-head button{border:1px solid #d8cabd;border-radius:999px;background:transparent;padding:7px 13px;color:#5b4035}.today-homework{padding:12px 18px;background:#fff6eb;border-bottom:1px solid #e0d1c2}.today-homework h3{margin:0 0 8px;font-size:13px;color:#a65a37}.today-homework>p{margin:0;color:#8a766b}.class-homework{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #ead3be;border-radius:12px;background:#fff}.class-homework i{font-style:normal;padding:5px 8px;border-radius:7px;background:#df6534;color:#fff;font-size:11px}.class-homework div{min-width:0;flex:1}.class-homework b,.class-homework small{display:block}.class-homework small{margin-top:3px;color:#8a766b}.class-homework button{border:0;border-radius:999px;padding:8px 12px;background:#4c8b64;color:#fff}.class-homework em{font-style:normal;color:#a65a37}.message-stream{height:calc(100% - 252px);overflow:auto;padding:20px;background:linear-gradient(rgba(255,255,255,.5),rgba(255,255,255,.5)),repeating-linear-gradient(0deg,transparent 0 31px,rgba(119,89,72,.025) 32px)}.message-row{display:flex;gap:9px;margin:15px 0;align-items:flex-start}.message-row>div:last-child{max-width:min(72%,560px)}.message-row small{color:#8d776c}.message-row p{margin:4px 0;padding:10px 13px;border-radius:4px 14px 14px 14px;background:#fff;line-height:1.6;box-shadow:0 3px 12px rgba(66,37,26,.07);white-space:pre-wrap;overflow-wrap:anywhere}.message-row time{font-size:10px;color:#a39187}.message-row.mine{flex-direction:row-reverse}.message-row.mine>div:last-child{text-align:right}.message-row.mine p{background:#f2a87d;border-radius:14px 4px 14px 14px;text-align:left}.message-row.mine .message-avatar{background:#5d8168}.message-system{margin:18px auto;max-width:620px;text-align:center}.message-system>small{display:inline-block;margin-bottom:7px;padding:4px 9px;border-radius:999px;background:#d7cec5;color:#77655c}.message-welcome{text-align:center;color:#8d796f;padding:40px}.message-compose{display:flex;gap:10px;height:72px;padding:12px 16px;background:#fffaf4;border-top:1px solid #dfd1c4}.message-compose textarea{flex:1;resize:none;padding:12px;border:1px solid #d5c5b7;border-radius:11px;font:inherit}.assignment-paper{height:100%;overflow:auto;padding:26px;background:#fffaf4}.assignment-back{border:0;background:transparent;color:#a84e2a;font-weight:800}.student-question{margin:15px 0;padding:16px;border:1px solid #e2d5ca;border-radius:14px;background:#fff}.student-question textarea{width:100%;padding:10px;border:1px solid #d5c5b7;border-radius:8px}.student-options{display:grid;gap:8px}.answer-correct{color:#28723e}.answer-wrong{color:#b44444}.score-card{font-size:26px;font-weight:800;color:#28723e}.class-error{padding:28px}.class-error button{float:right;border:0;background:none;font-size:25px}@media(max-width:720px){.class-dialog{width:100%;height:100dvh;max-width:none;max-height:none;border-radius:0}.class-shell{grid-template-columns:92px 1fr}.class-rail-head{padding:10px}.class-rail-head b{font-size:0}.class-rail-head b:after{content:'班级';font-size:16px}.class-list>button{display:grid;justify-items:center;padding:8px 2px}.class-list>button>div b{font-size:12px;text-align:center}.class-list>button>div small{display:none}.class-list>button>span{width:42px}.class-join{display:grid;padding:6px}.class-join input{width:100%;font-size:11px}.class-join button{min-height:36px}.today-homework{padding:9px}.class-homework{align-items:flex-start;flex-wrap:wrap}.class-homework button{margin-left:auto}.message-stream{height:calc(100% - 280px);padding:12px}.message-row>div:last-child{max-width:82%}.message-avatar{width:34px;height:34px}.message-compose{padding:9px;height:66px}.message-compose button{padding:0 12px}}`;
  style.textContent += `.class-conversation{height:100%;display:flex;min-height:0;flex-direction:column}.class-conversation .message-stream{height:auto;min-height:0;flex:1}`;
  document.head.append(style);
  window.MusicHomework = { open };
})();
