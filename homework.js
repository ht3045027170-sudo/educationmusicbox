(() => {
  'use strict';
  let csrfToken = '', refreshTimer = 0, selectedSystem = 'gaokao', selectedClass = null, replyTo = null, chatSnapshot = null;
  const dialog = document.createElement('dialog');
  dialog.className = 'class-dialog';
  document.body.append(dialog);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const user = () => window.HetianAuth?.getUser?.() || null;
  const isTeacher = () => ['teacher', 'admin'].includes(user()?.role);
  const teacherLabel = value => /老师$/.test(String(value || '')) ? String(value) : `${value || '教师'}老师`;
  const dateText = value => value ? new Date(String(value).endsWith('Z') ? value : `${value}Z`).toLocaleString() : '—';

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

  const chatShell = classes => `<div class="class-shell ${classes.length ? '' : 'no-classes'}">
    <aside class="class-rail"><div class="class-rail-head"><b>我的班级</b><button type="button" data-close aria-label="关闭">×</button></div>
      <div class="class-list">${classes.map(item => `<button type="button" data-class="${item.id}" class="${item.id === selectedClass ? 'active' : ''}"><span>${esc(item.name.slice(0, 1))}</span><div><b>${esc(item.name)}</b><small>${esc(teacherLabel(item.teacher_name || item.teacher_username))}</small></div>${Number(item.unread_count||0)>0?`<em class="unread-count">${Number(item.unread_count)>99?'99+':Number(item.unread_count)}</em>`:''}</button>`).join('') || '<p>尚未加入班级</p>'}</div>
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
        try {
          await api(`/api/learning/${selectedSystem}/classes/join`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ inviteCode:new FormData(event.currentTarget).get('inviteCode') }) });
          selectedClass = null; await open(selectedSystem);
        } catch (error) { alert(error.message); }
      });
      if (!dialog.open) dialog.showModal();
      if (selectedClass) await openClass(selectedClass);
      refreshTimer = setInterval(() => {
        const composer = dialog.querySelector('.message-compose textarea');
        if (selectedClass && document.activeElement !== composer && !dialog.querySelector('.class-drawer')) loadConversation(false).catch(() => {});
      }, 5000);
    } catch (error) { showError('我的班级', error); }
  }

  async function openClass(classId) {
    selectedClass = classId; replyTo = null;
    dialog.querySelectorAll('[data-class]').forEach(button => button.classList.toggle('active', Number(button.dataset.class) === classId));
    await loadConversation(true);
  }

  function assignmentStatus(item) {
    const overdue = item.due_at && Date.parse(item.due_at) < Date.now() && !item.submitted_at;
    if (overdue) return ['OVERDUE', '已截止'];
    if (item.submitted_at) return ['GRADED', `已完成 · ${item.score}分`];
    return ['NOT_STARTED', '待完成'];
  }
  function assignmentCard(item, compact = false) {
    if (item.deleted) return `<article class="class-homework deleted"><i>作业</i><div><b>${esc(item.title)}</b><small>该作业已被教师删除</small></div></article>`;
    const [state, label] = assignmentStatus(item);
    return `<article class="class-homework ${compact ? 'compact' : ''}"><i>作业</i><div><b>${esc(item.title)}</b><small>${item.question_count || 0} 题${item.due_at ? ` · ${dateText(item.due_at)} 截止` : ''}${item.allow_retry ? ` · 可重做${item.max_attempts ? item.max_attempts + '次' : ''}` : ''}</small></div>${isTeacher() ? '<em>已发布</em>' : `<button type="button" data-assignment="${item.id}" data-review="${item.submitted_at ? 1 : 0}">${state === 'OVERDUE' ? '已截止' : label}</button>`}</article>`;
  }

  function messageHTML(message, previous, assignments) {
    if (message.kind === 'system') return `<div class="message-system" id="message-${message.id}"><small>${esc(message.content)}</small></div>`;
    if (message.kind === 'assignment') {
      const item = assignments.find(entry => Number(entry.id) === Number(message.assignment_id)) || { id:message.assignment_id, title:message.content, deleted:true };
      return `<div class="message-system" id="message-${message.id}"><small>老师发布了新作业</small>${assignmentCard(item, true)}</div>`;
    }
    const previousTime = previous ? Date.parse(`${previous.created_at}Z`) : 0;
    const compact = previous && previous.kind === 'text' && Number(previous.sender_id) === Number(message.sender_id) && Date.parse(`${message.created_at}Z`) - previousTime < 5 * 60000;
    const reply = message.reply_to ? `<blockquote>回复 ${esc(message.reply_name || message.reply_username || '班级成员')}：${esc(message.reply_content || '原消息已删除')}</blockquote>` : '';
    return `<article id="message-${message.id}" data-message-id="${message.id}" class="message-row ${message.is_mine ? 'mine' : 'other'} ${compact ? 'compact' : ''} ${message.deleted_at ? 'deleted' : ''}">
      <div class="message-avatar">${esc((message.display_name || message.username || '同').slice(0, 1))}</div><div><small>${esc(message.display_name || message.username || '班级成员')}${['teacher','admin'].includes(message.role) ? ' · 教师' : ''}</small>${reply}<p>${esc(message.content)}</p><time>${dateText(message.created_at)}</time></div>
      ${message.deleted_at ? '' : `<button class="message-more" type="button" aria-label="消息操作">···</button><menu><button type="button" data-reply="${message.id}">回复</button><button type="button" data-copy="${message.id}">复制</button>${message.can_pin ? `<button type="button" data-pin="${message.id}" data-pinned="${message.pinned_at ? 1 : 0}">${message.pinned_at ? '取消置顶' : '置顶'}</button>` : ''}${message.can_delete ? `<button type="button" data-delete-message="${message.id}">删除</button>` : ''}</menu>`}
    </article>`;
  }

  async function loadConversation(scrollToEnd, query = '') {
    const target = dialog.querySelector('#classConversation');
    if (!target || !selectedClass) return;
    const oldStream = target.querySelector('.message-stream'), oldScrollTop = oldStream?.scrollTop || 0;
    const wasNearBottom = !oldStream || oldStream.scrollHeight - oldStream.scrollTop - oldStream.clientHeight < 80;
    const suffix = query ? `?${query}` : '';
    const [messages, assignments] = await Promise.all([
      api(`/api/learning/${selectedSystem}/classes/${selectedClass}/messages${suffix}`), api(`/api/learning/${selectedSystem}/assignments`)
    ]);
    if (Number(messages.viewer?.id) !== Number(user()?.id)) return location.reload();
    chatSnapshot = messages;
    const classAssignments = assignments.items.filter(item => Number(item.class_id) === Number(selectedClass));
    const localDay = value => value ? new Date(String(value).endsWith('Z') ? value : `${value}Z`).toLocaleDateString() : '';
    const today = classAssignments.filter(item => !item.submitted_at && localDay(item.created_at) === new Date().toLocaleDateString()).slice(0, 4);
    target.className = 'class-conversation';
    target.innerHTML = `<header class="conversation-head"><div><b>${esc(messages.class.name)}</b><small>${messages.class.member_count} 人</small></div><div><button type="button" data-search>搜索</button><button type="button" data-settings>···</button></div></header>
      ${messages.class.announcement ? `<button type="button" class="announcement" data-settings><b>班级公告</b><span>${esc(messages.class.announcement)}</span></button>` : ''}
      ${messages.pinned?.length ? `<button type="button" class="pinned-banner" ${messages.pinned.length > 1 ? 'data-pinned-list' : `data-jump="${messages.pinned[0].id}"`}><b>置顶</b><span>${esc(messages.pinned[0].content)}</span><em>${messages.pinned.length > 1 ? `共 ${messages.pinned.length} 条` : '查看'}</em></button>` : ''}
      <section class="today-homework"><h3>今日作业</h3>${today.map(item => assignmentCard(item)).join('') || '<p>今天没有新作业。</p>'}<button type="button" data-assignment-center>查看全部作业</button></section>
      <section class="message-stream">${messages.has_more ? '<button type="button" class="load-older" data-load-older>查看更早消息</button>' : ''}${messages.items.map((message,index) => messageHTML(message, messages.items[index - 1], classAssignments)).join('') || '<div class="message-welcome">还没有消息，和大家打个招呼吧。</div>'}</section>
      <form class="message-compose"><div class="reply-preview" ${replyTo ? '' : 'hidden'}></div><textarea name="content" maxlength="1000" rows="1" placeholder="发送班级消息" required></textarea><button>发送</button></form>`;
    bindConversation(target, classAssignments);
    const stream = target.querySelector('.message-stream');
    if (scrollToEnd || wasNearBottom) stream.scrollTop = stream.scrollHeight; else stream.scrollTop = oldScrollTop;
  }

  function bindConversation(target) {
    target.querySelector('[data-search]')?.addEventListener('click', openSearch);
    target.querySelectorAll('[data-settings]').forEach(button => button.addEventListener('click', openSettings));
    target.querySelector('[data-pinned-list]')?.addEventListener('click', openPinned);
    target.querySelector('[data-load-older]')?.addEventListener('click', loadOlder);
    target.querySelector('[data-assignment-center]')?.addEventListener('click', () => openAssignments(selectedSystem));
    target.querySelectorAll('[data-assignment]').forEach(button => button.onclick = () => openAssignment(selectedSystem, button.dataset.assignment, button.dataset.review === '1'));
    target.querySelectorAll('[data-jump]').forEach(button => button.onclick = () => jumpToMessage(button.dataset.jump));
    bindMessageMenus(target, target);
    target.onclick = async event => {
      const row = event.target.closest('.message-row');
      if (!row) target.querySelectorAll('.message-row.menu-open').forEach(item => item.classList.remove('menu-open'));
      const id = event.target.dataset.reply || event.target.dataset.copy || event.target.dataset.pin || event.target.dataset.deleteMessage;
      if (!id) return;
      const message = chatSnapshot?.items.find(item => Number(item.id) === Number(id));
      if (!message) return;
      if (event.target.dataset.reply) {
        replyTo = message; const preview = target.querySelector('.reply-preview'); preview.hidden = false; preview.innerHTML = `<span>回复 ${esc(message.display_name || message.username)}：${esc(message.content.slice(0, 80))}</span><button type="button" data-cancel-reply>×</button>`; target.querySelector('textarea').focus();
      } else if (event.target.dataset.copy) {
        try { await navigator.clipboard.writeText(message.content); } catch { prompt('复制消息：', message.content); }
      } else if (event.target.dataset.pin) {
        await patchMessage(event.target.dataset.pinned === '1' ? 'unpin' : 'pin', id); await loadConversation(false);
      } else if (event.target.dataset.deleteMessage && confirm('确定删除这条消息吗？聊天位置会保留删除提示。')) {
        await patchMessage('delete', id); await loadConversation(false);
      }
    };
    target.querySelector('[data-cancel-reply]')?.addEventListener('click', () => { replyTo = null; target.querySelector('.reply-preview').hidden = true; });
    const form = target.querySelector('.message-compose'), textarea = form.querySelector('textarea');
    textarea.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
    form.onsubmit = async event => {
      event.preventDefault(); const button = form.querySelector('button'), content = textarea.value.trim(); if (!content) return;
      button.disabled = true;
      try {
        await api(`/api/learning/${selectedSystem}/classes/${selectedClass}/messages`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ content, replyTo:replyTo?.id || null }) });
        replyTo = null; await loadConversation(true);
      } catch (error) { alert(error.message); } finally { button.disabled = false; }
    };
  }

  function bindMessageMenus(scope, target) {
    scope.querySelectorAll('.message-more:not([data-bound])').forEach(button => {
      button.dataset.bound = '1';
      button.onclick = event => {
      event.stopPropagation();
      const row = button.closest('.message-row');
      target.querySelectorAll('.message-row.menu-open').forEach(item => item !== row && item.classList.remove('menu-open'));
      row.classList.toggle('menu-open');
      };
    });
  }

  async function loadOlder() {
    const stream = dialog.querySelector('.message-stream'), first = stream?.querySelector('[data-message-id],.message-system[id]');
    if (!stream || !first) return;
    const before = Number(String(first.id || first.dataset.messageId || '').replace('message-', ''));
    const data = await api(`/api/learning/${selectedSystem}/classes/${selectedClass}/messages?before=${before}`);
    const assignments = (await api(`/api/learning/${selectedSystem}/assignments`)).items.filter(item => Number(item.class_id) === Number(selectedClass));
    const button = stream.querySelector('[data-load-older]'), oldHeight = stream.scrollHeight;
    const html = `${data.has_more ? '<button type="button" class="load-older" data-load-older>查看更早消息</button>' : ''}${data.items.map((message,index) => messageHTML(message, data.items[index - 1], assignments)).join('')}`;
    button?.remove(); stream.insertAdjacentHTML('afterbegin', html); stream.scrollTop += stream.scrollHeight - oldHeight;
    chatSnapshot.items = [...data.items, ...(chatSnapshot?.items || [])];
    stream.querySelector('[data-load-older]')?.addEventListener('click', loadOlder);
    bindMessageMenus(stream, dialog.querySelector('#classConversation'));
  }

  function openPinned() {
    const items = chatSnapshot?.pinned || [], drawer = document.createElement('aside');
    drawer.className = 'class-drawer';
    drawer.innerHTML = `<header><h3>置顶消息</h3><button type="button" data-close-drawer>×</button></header><section class="drawer-results">${items.map(item => `<button type="button" data-pinned-jump="${item.id}"><b>${esc(item.display_name || item.username || '班级成员')}</b><span>${esc(item.content)}</span><small>${dateText(item.created_at)}</small></button>`).join('') || '<p>暂无置顶消息。</p>'}</section>`;
    dialog.querySelector('.class-main').append(drawer);
    drawer.querySelector('[data-close-drawer]').onclick = () => drawer.remove();
    drawer.querySelectorAll('[data-pinned-jump]').forEach(button => button.onclick = async () => { const id=button.dataset.pinnedJump; drawer.remove(); if(!document.getElementById(`message-${id}`)) await loadConversation(false,`messageId=${id}`); jumpToMessage(id); });
  }

  async function patchMessage(action, messageId, content = '') {
    return api(`/api/learning/${selectedSystem}/classes/${selectedClass}/messages`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({ action, messageId, content }) });
  }
  function jumpToMessage(id) {
    const node = dialog.querySelector(`#message-${id}`); if (!node) return;
    node.scrollIntoView({ block:'center', behavior:'smooth' }); node.classList.add('message-focus'); setTimeout(() => node.classList.remove('message-focus'), 1600);
  }

  function openSearch() {
    const drawer = document.createElement('aside'); drawer.className = 'class-drawer';
    drawer.innerHTML = `<header><h3>查找聊天记录</h3><button type="button" data-drawer-close>×</button></header><form class="chat-search"><input name="q" placeholder="消息内容或发送人"><select name="senderId"><option value="">全部成员</option>${(chatSnapshot?.members || []).map(member => `<option value="${member.id}">${esc(member.display_name || member.username)}</option>`).join('')}</select><input name="date" type="date"><button>查找</button></form><div class="drawer-results"><p>输入关键词、成员或日期开始查找。</p></div>`;
    dialog.querySelector('.class-main').append(drawer); drawer.querySelector('[data-drawer-close]').onclick = () => drawer.remove();
    drawer.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const fd = new FormData(event.currentTarget), params = new URLSearchParams();
      for (const key of ['q','senderId','date']) if (fd.get(key)) params.set(key, fd.get(key));
      const data = await api(`/api/learning/${selectedSystem}/classes/${selectedClass}/messages?${params}`);
      drawer.querySelector('.drawer-results').innerHTML = data.items.map(item => `<button type="button" data-result="${item.id}"><b>${esc(item.display_name || item.username || '系统')}</b><span>${esc(item.content)}</span><small>${dateText(item.created_at)}</small></button>`).join('') || '<p>没有找到相关聊天记录。</p>';
      drawer.querySelectorAll('[data-result]').forEach(button => button.onclick = () => { drawer.remove(); loadConversation(false).then(() => jumpToMessage(button.dataset.result)); });
    };
  }

  function openSettings() {
    const data = chatSnapshot, drawer = document.createElement('aside'); drawer.className = 'class-drawer';
    drawer.innerHTML = `<header><h3>班级群设置</h3><button type="button" data-drawer-close>×</button></header>
      <section><h4>班级公告</h4>${data.viewer.is_teacher ? `<form data-announcement><textarea name="content" maxlength="2000" placeholder="课程、上课时间与考试安排">${esc(data.class.announcement)}</textarea><button>保存公告</button></form>` : `<p>${esc(data.class.announcement || '老师尚未发布公告。')}</p>`}</section>
      <section><h4>成员 · ${data.class.member_count} 人</h4><input data-member-filter placeholder="搜索班级成员"><div class="member-list">${data.members.map(member => `<article data-member-name="${esc(`${member.display_name || member.username}`.toLowerCase())}"><span>${esc((member.display_name || member.username).slice(0,1))}</span><div><b>${esc(member.display_name || member.username)}</b><small>${['teacher','admin'].includes(member.role) ? '教师' : '学生'}</small></div>${data.viewer.is_teacher && !['teacher','admin'].includes(member.role) ? `<button type="button" data-remove-member="${member.id}">移出</button>` : ''}</article>`).join('')}</div></section>
      ${data.viewer.is_teacher ? `<section><h4>添加学生</h4><form data-member-search><input name="search" required placeholder="姓名、用户名或邮箱"><button>搜索</button></form><div class="member-search-results"></div></section>` : `<section><h4>加入其他班级</h4><form data-join-another><input name="inviteCode" maxlength="20" required placeholder="输入班级邀请码"><button>加入班级</button></form></section>`}`;
    dialog.querySelector('.class-main').append(drawer); drawer.querySelector('[data-drawer-close]').onclick = () => drawer.remove();
    drawer.querySelector('[data-member-filter]')?.addEventListener('input', event => drawer.querySelectorAll('[data-member-name]').forEach(item => item.hidden = !item.dataset.memberName.includes(event.target.value.trim().toLowerCase())));
    drawer.querySelector('[data-announcement]')?.addEventListener('submit', async event => { event.preventDefault(); await patchMessage('announcement', 0, new FormData(event.currentTarget).get('content')); drawer.remove(); loadConversation(false); });
    drawer.querySelector('[data-join-another]')?.addEventListener('submit', async event => { event.preventDefault(); await api(`/api/learning/${selectedSystem}/classes/join`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({inviteCode:new FormData(event.currentTarget).get('inviteCode')}) }); drawer.remove(); selectedClass=null; open(selectedSystem); });
    drawer.querySelectorAll('[data-remove-member]').forEach(button => button.onclick = async () => { if (!confirm('确定将该学生移出班级吗？历史成绩会保留。')) return; await api(`/api/teaching/${selectedSystem}/classes/${selectedClass}/students/${button.dataset.removeMember}`, { method:'DELETE' }); drawer.remove(); loadConversation(false); });
    drawer.querySelector('[data-member-search]')?.addEventListener('submit', async event => {
      event.preventDefault(); const query = encodeURIComponent(new FormData(event.currentTarget).get('search'));
      const result = await api(`/api/teaching/${selectedSystem}/classes/${selectedClass}/students?search=${query}`), box = drawer.querySelector('.member-search-results');
      box.innerHTML = result.items.map(member => `<article><div><b>${esc(member.display_name || member.username)}</b><small>${esc(member.email || member.username)}</small></div><button type="button" data-add-member="${member.user_id}">添加</button></article>`).join('') || '<p>没有找到可添加的学生。</p>';
      box.querySelectorAll('[data-add-member]').forEach(button => button.onclick = async () => { await api(`/api/teaching/${selectedSystem}/classes/${selectedClass}/students`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({studentId:Number(button.dataset.addMember)}) }); drawer.remove(); loadConversation(false); });
    });
  }

  async function openAssignments(systemCode = 'gaokao', filter = 'all') {
    selectedSystem = systemCode; clearInterval(refreshTimer);
    try {
      const data = await api(`/api/learning/${systemCode}/assignments`);
      const groups = { today:[], soon:[], later:[], past:[] }, now = Date.now(), tomorrow = now + 86400000, week = now + 7*86400000;
      data.items.forEach(item => { const due = item.due_at ? Date.parse(item.due_at) : Infinity; (due < now ? groups.past : due < tomorrow ? groups.today : due < week ? groups.soon : groups.later).push(item); });
      const visible = item => filter === 'all' || (filter === 'pending' && !item.submitted_at && (!item.due_at || Date.parse(item.due_at) >= now)) || (filter === 'done' && item.submitted_at) || (filter === 'overdue' && !item.submitted_at && item.due_at && Date.parse(item.due_at) < now);
      const section = (title, items) => { const rows = items.filter(visible); return rows.length ? `<section class="assignment-group"><h3>${title}</h3>${rows.map(assignmentRow).join('')}</section>` : ''; };
      dialog.innerHTML = `<main class="assignment-center"><header><div><span>MY ASSIGNMENTS</span><h2>作业中心</h2></div><button type="button" data-close>×</button></header><nav>${[['all','全部'],['pending','待完成'],['done','已完成'],['overdue','已截止']].map(([key,label])=>`<button type="button" class="${filter===key?'active':''}" data-assignment-filter="${key}">${label}</button>`).join('')}</nav><div>${section('今天截止',groups.today)}${section('本周',groups.soon)}${section('之后',groups.later)}${section('已截止',groups.past)}${data.items.filter(visible).length ? '' : '<p class="assignment-empty">当前没有符合条件的作业。</p>'}</div></main>`;
      if (!dialog.open) dialog.showModal();
      dialog.querySelector('[data-close]').onclick = () => dialog.close();
      dialog.querySelectorAll('[data-assignment-filter]').forEach(button => button.onclick = () => openAssignments(systemCode, button.dataset.assignmentFilter));
      dialog.querySelectorAll('[data-assignment]').forEach(button => button.onclick = () => openAssignment(systemCode, button.dataset.assignment, button.dataset.review === '1'));
    } catch (error) { showError('作业中心', error); }
  }
  function assignmentRow(item) {
    const [,label] = assignmentStatus(item), canRetry = item.submitted_at && item.allow_retry && (!item.max_attempts || item.attempt_count < item.max_attempts);
    return `<article class="assignment-row"><div><b>${esc(item.title)}</b><small>${esc(item.class_name)} · ${item.question_count} 题${item.due_at ? ` · ${dateText(item.due_at)} 截止` : ''}</small></div><div><span class="assignment-state">${label}</span>${item.submitted_at ? `<small>已作答 ${item.attempt_count || 1}${item.max_attempts ? ` / ${item.max_attempts}` : ''} 次${canRetry ? ' · 可重做' : ''}</small>` : ''}</div><button type="button" data-assignment="${item.id}" data-review="${item.submitted_at ? 1 : 0}">${item.submitted_at ? '查看结果' : '开始作业'}</button></article>`;
  }

  function questionInput(question, disabled = false) {
    const content = question.content || {}, options = Array.isArray(content.options) ? content.options : [];
    if (options.length) return `<div class="student-options">${options.map(option => `<label><input type="radio" name="q${question.question_id}" value="${esc(option)}" ${question.answer === option ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${esc(option)}</label>`).join('')}</div>`;
    return `<textarea name="q${question.question_id}" ${disabled ? 'disabled' : ''} placeholder="填写答案">${esc(question.answer ?? '')}</textarea>`;
  }

  async function openAssignment(systemCode, id, review = false) {
    const data = await api(`/api/learning/${systemCode}/assignments/${id}${review ? '?review=1' : ''}`), submitted = Boolean(data.assignment.submitted_at), canSubmit = Boolean(data.assignment.can_submit) && !review;
    const attempts = data.attempts || [];
    const questionMap=new Map(data.questions.map(question=>[Number(question.question_id),question])), fallback=[{title:'练习题',question_ids:data.questions.map(question=>Number(question.question_id))}], sections=data.assignment.sections?.length?data.assignment.sections:fallback;let questionNo=0;
    const paper=sections.map(section=>`<section class="assignment-section"><header><span>${esc(section.type||'PAPER')}</span><h3>${esc(section.title)}</h3></header>${section.question_ids.map(qid=>questionMap.get(Number(qid))).filter(Boolean).map(question=>{questionNo++;return `<article class="student-question"><h3>${questionNo}. ${esc(question.content.prompt || question.content.question || '题目')}</h3>${questionInput(question, review)}${review ? `<p class="${question.correct ? 'answer-correct' : 'answer-wrong'}">${question.correct ? '回答正确' : '回答错误'} · 标准答案：${esc(question.content.answer ?? '')}</p><p>${esc(question.content.explanation || '')}</p>` : ''}</article>`}).join('')}</section>`).join('');
    dialog.innerHTML = `<form class="assignment-paper"><button type="button" class="assignment-back" data-back>← 返回作业中心</button><header><span>ASSIGNMENT</span><h2>${esc(data.assignment.title)}</h2><p>${esc(data.assignment.instructions || '完成后统一提交。')}</p><div class="assignment-meta">${data.assignment.due_at ? `截止 ${dateText(data.assignment.due_at)}` : '不设截止时间'} · ${data.questions.length} 题 · ${data.assignment.allow_retry ? `允许重做${data.assignment.max_attempts ? ` ${data.assignment.max_attempts} 次` : ''}` : '不可重做'} · 取最高分</div></header>${paper}
      ${review ? `<div class="score-card">最高成绩：${data.assignment.score} 分</div><div class="attempt-history"><b>作答记录</b>${attempts.map(item=>`<span>第 ${item.attempt_no} 次 · ${item.score} 分 · ${dateText(item.submitted_at)}</span>`).join('')}</div>${data.assignment.can_submit ? '<button type="button" class="assignment-submit" data-retry>重新作答</button>' : ''}` : '<button class="assignment-submit">提交整份作业</button><p class="auth-message"></p>'}</form>`;
    dialog.querySelector('[data-back]').onclick = () => openAssignments(systemCode);
    dialog.querySelector('[data-retry]')?.addEventListener('click', () => openAssignment(systemCode,id,false));
    if (canSubmit) dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const fd=new FormData(event.currentTarget), answers={}; data.questions.forEach(question=>answers[question.question_id]=fd.get(`q${question.question_id}`)??'');
      try { await api(`/api/learning/${systemCode}/assignments/${id}/submit`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({answers})}); openAssignment(systemCode,id,true); } catch(error){ event.currentTarget.querySelector('.auth-message').textContent=error.message; }
    };
  }

  function showError(title, error) {
    dialog.innerHTML = `<div class="class-error"><button type="button" data-close>×</button><h2>${esc(title)}</h2><p>${esc(error.message)}</p></div>`;
    dialog.querySelector('[data-close]').onclick = () => dialog.close(); if (!dialog.open) dialog.showModal();
  }

  dialog.addEventListener('close', () => { clearInterval(refreshTimer); replyTo = null; });
  window.addEventListener('hetian:auth-changed', () => { csrfToken=''; selectedClass=null; clearInterval(refreshTimer); if(dialog.open)dialog.close(); });
  const style=document.createElement('style'); style.textContent=`
    .class-dialog{width:min(1160px,calc(100% - 24px));height:min(820px,calc(100dvh - 24px));padding:0;border:0;border-radius:22px;overflow:hidden;background:#f3eee7;color:#3d2a23;box-shadow:0 30px 90px rgba(49,24,15,.3)}.class-dialog::backdrop{background:rgba(42,24,17,.5);backdrop-filter:blur(7px)}
    .class-shell{display:grid;grid-template-columns:280px 1fr;height:100%;min-height:0}.class-rail{display:flex;flex-direction:column;min-height:0;background:#efe7dc;border-right:1px solid #d6c8ba}.class-rail-head,.conversation-head{display:flex;align-items:center;justify-content:space-between;min-height:72px;padding:14px 18px;border-bottom:1px solid #d8cabd}.class-rail-head b{font:700 22px Georgia,"Songti SC",serif}.class-rail-head button{border:0;background:none;font-size:28px;color:#795f53}.class-list{flex:1;overflow:auto;padding:9px}.class-list>button{width:100%;display:flex;gap:11px;align-items:center;padding:11px;border:0;border-radius:12px;background:transparent;text-align:left;color:inherit}.class-list>button.active{background:#fff8f1}.class-list>button>span,.message-avatar{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border-radius:10px;background:#df6534;color:#fff;font-weight:800}.class-list b,.class-list small{display:block}.class-list small{margin-top:4px;color:#88746a}.class-join{display:flex;gap:7px;padding:12px;border-top:1px solid #d8cabd}.class-join input{min-width:0;flex:1;padding:10px;border:1px solid #cfbfb0;border-radius:9px}.class-join button,.message-compose button,.assignment-submit,.class-drawer button{border:0;border-radius:9px;background:#df6534;color:#fff;font-weight:800;padding:0 16px}.class-main{position:relative;min-width:0;min-height:0;height:100%;overflow:hidden}.class-empty{display:grid;place-items:center;height:100%;color:#8a766b}.class-conversation{height:100%;display:flex;flex-direction:column;min-height:0;overflow:hidden}.conversation-head{flex:0 0 auto;background:#fffaf4}.conversation-head small{display:block;margin-top:4px;color:#8a766b}.conversation-head>div:last-child{display:flex;gap:7px}.conversation-head button{border:1px solid #d8cabd;border-radius:999px;background:transparent;padding:7px 13px;color:#5b4035}.announcement,.pinned-banner{display:flex;align-items:center;gap:10px;width:100%;padding:9px 18px;border:0;border-bottom:1px solid #ead8c8;background:#fff9ef;color:#5b4035;text-align:left}.announcement b,.pinned-banner b{color:#bd542b}.announcement span,.pinned-banner span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pinned-banner em{font-style:normal;color:#9a7663}.today-homework{position:relative;flex:0 0 auto;padding:10px 18px;background:#fff6eb;border-bottom:1px solid #e0d1c2}.today-homework h3{margin:0 0 7px;font-size:13px;color:#a65a37}.today-homework>p{margin:0;color:#8a766b}.today-homework>[data-assignment-center]{position:absolute;right:18px;top:8px;border:0;background:none;color:#b7542e}.class-homework{display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid #ead3be;border-radius:12px;background:#fff}.class-homework i{font-style:normal;padding:5px 8px;border-radius:7px;background:#df6534;color:#fff;font-size:11px}.class-homework div{min-width:0;flex:1}.class-homework b,.class-homework small{display:block}.class-homework small{margin-top:3px;color:#8a766b}.class-homework button{border:0;border-radius:999px;padding:8px 12px;background:#df6534;color:#fff}.class-homework em{font-style:normal;color:#a65a37}.class-homework.deleted{opacity:.66}.message-stream{min-height:0;flex:1 1 0;overflow-y:auto;overscroll-behavior:contain;padding:20px;background:linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,.55)),repeating-linear-gradient(0deg,transparent 0 31px,rgba(119,89,72,.025) 32px)}.message-row{position:relative;display:flex;gap:9px;margin:15px 0;align-items:flex-start}.message-row.compact{margin-top:-8px}.message-row.compact .message-avatar,.message-row.compact>div>small{visibility:hidden}.message-row>div:nth-child(2){max-width:min(72%,560px)}.message-row small{color:#8d776c}.message-row p{margin:4px 0;padding:10px 13px;border-radius:4px 14px 14px 14px;background:#fff;line-height:1.6;box-shadow:0 3px 12px rgba(66,37,26,.07);white-space:pre-wrap;overflow-wrap:anywhere}.message-row blockquote{margin:5px 0 0;padding:6px 9px;border-left:3px solid #d78b66;border-radius:5px;background:rgba(255,255,255,.6);font-size:12px;color:#806b60}.message-row time{font-size:10px;color:#a39187}.message-row.mine{flex-direction:row-reverse}.message-row.mine>div:nth-child(2){text-align:right}.message-row.mine p{background:#f2a87d;border-radius:14px 4px 14px 14px;text-align:left}.message-row.mine .message-avatar{background:#7e5b49}.message-row.deleted p{color:#9c8d85;font-style:italic}.message-more{visibility:hidden;border:0;background:none;color:#8d776c;padding:4px}.message-row:hover .message-more,.message-row:focus-within .message-more{visibility:visible}.message-row menu{display:none;position:absolute;z-index:3;top:25px;left:60px;margin:0;padding:5px;border:1px solid #ddcfc3;border-radius:10px;background:#fff;box-shadow:0 12px 30px rgba(50,30,20,.16)}.message-row.mine menu{right:60px;left:auto}.message-row.menu-open menu{display:flex}.message-row menu button{border:0;background:none;padding:7px;color:#5f4337}.message-system{margin:18px auto;max-width:620px;text-align:center}.message-system>small{display:inline-block;margin-bottom:7px;padding:4px 9px;border-radius:999px;background:#d7cec5;color:#77655c}.message-focus{animation:messageFocus 1.5s ease}.message-welcome{text-align:center;color:#8d796f;padding:40px}.message-compose{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;gap:8px;min-height:72px;padding:10px 16px;background:#fffaf4;border-top:1px solid #dfd1c4}.message-compose textarea{min-width:0;resize:none;padding:12px;border:1px solid #d5c5b7;border-radius:11px;font:inherit}.reply-preview{grid-column:1/-1;display:flex;justify-content:space-between;padding:6px 9px;border-radius:8px;background:#f1e5da;font-size:12px}.reply-preview[hidden]{display:none}.reply-preview button{border:0;background:none}.class-drawer{position:absolute;z-index:5;inset:0 0 0 auto;width:min(430px,100%);overflow:auto;padding:18px;background:#fffaf4;border-left:1px solid #decfc2;box-shadow:-18px 0 45px rgba(66,40,28,.16)}.class-drawer>header{display:flex;align-items:center;justify-content:space-between}.class-drawer>header h3{font:500 24px Georgia,"Songti SC",serif}.class-drawer>header button{background:none;color:#65483c;font-size:24px}.class-drawer section{padding:14px 0;border-top:1px solid #eadfd5}.class-drawer textarea,.class-drawer input,.class-drawer select{box-sizing:border-box;width:100%;padding:10px;border:1px solid #d6c7ba;border-radius:9px}.class-drawer form{display:grid;gap:8px}.class-drawer form button{min-height:38px}.member-list article,.member-search-results article{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #eee2d8}.member-list article>span{width:36px;height:36px;display:grid;place-items:center;border-radius:9px;background:#df6534;color:#fff}.member-list article>div,.member-search-results article>div{flex:1}.member-list small,.member-search-results small{display:block;color:#8e786d}.member-list button,.member-search-results button{min-height:32px}.chat-search{grid-template-columns:1fr 1fr}.chat-search input:first-child{grid-column:1/-1}.drawer-results>button{display:grid;width:100%;gap:3px;margin-top:8px;padding:11px;border:1px solid #e3d6ca;border-radius:10px;background:#fff;color:#51382d;text-align:left}.drawer-results span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.drawer-results small{color:#987f73}
    .assignment-center{height:100%;overflow:auto;padding:28px;background:#fff8f1}.assignment-center>header{display:flex;justify-content:space-between;align-items:start}.assignment-center>header span{font:700 11px ui-monospace,monospace;letter-spacing:.17em;color:#df6534}.assignment-center h2{margin:7px 0;font:500 40px Georgia,"Songti SC",serif}.assignment-center>header button{border:0;background:none;font-size:28px}.assignment-center>nav{display:flex;gap:8px;margin:18px 0;padding-bottom:12px;border-bottom:1px solid #decfc2}.assignment-center>nav button{border:0;border-radius:999px;padding:9px 15px;background:#efe3d8;color:#64483c}.assignment-center>nav button.active{background:#df6534;color:#fff}.assignment-group{margin:20px 0}.assignment-group h3{font-size:14px;color:#a45a39}.assignment-row{display:grid;grid-template-columns:minmax(0,1fr) 180px auto;gap:16px;align-items:center;padding:14px 4px;border-bottom:1px solid #eadfd5}.assignment-row b,.assignment-row small{display:block}.assignment-row small{margin-top:5px;color:#8b766c}.assignment-row>div:nth-child(2){text-align:right}.assignment-row>button{border:0;border-radius:999px;padding:9px 14px;background:#df6534;color:#fff}.assignment-state{font-weight:750}.assignment-empty{padding:50px;text-align:center;color:#8b766c}.assignment-paper{box-sizing:border-box;height:100%;overflow:auto;padding:26px;background:#fffaf4}.assignment-paper>header{max-width:900px;margin:18px auto}.assignment-paper>header>span{font:700 11px ui-monospace,monospace;letter-spacing:.17em;color:#df6534}.assignment-paper h2{font:500 38px Georgia,"Songti SC",serif}.assignment-meta{color:#8b766c}.assignment-back{border:0;background:transparent;color:#a84e2a;font-weight:800}.assignment-section{max-width:940px;margin:28px auto;padding:18px;border:1px solid #dfcfc2;border-radius:18px;background:#f8ecdf}.assignment-section>header{padding:2px 8px 10px;border-bottom:1px solid #dfcfc2}.assignment-section>header span{font:700 10px ui-monospace,monospace;letter-spacing:.14em;color:#df6534}.assignment-section>header h3{margin:5px 0 0;font:500 24px Georgia,"Songti SC",serif}.student-question{max-width:900px;margin:15px auto;padding:16px;border:1px solid #e2d5ca;border-radius:14px;background:#fff}.student-question textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid #d5c5b7;border-radius:8px}.student-options{display:grid;gap:8px}.answer-correct{color:#28723e}.answer-wrong{color:#b44444}.score-card,.attempt-history,.assignment-paper>.assignment-submit,.assignment-paper>.auth-message{display:block;max-width:900px;margin:18px auto}.score-card{font-size:26px;font-weight:800;color:#28723e}.attempt-history{display:flex;gap:8px;flex-wrap:wrap}.attempt-history span{padding:7px 10px;border-radius:999px;background:#efe5dc}.assignment-paper>.assignment-submit{min-height:46px;width:100%}.load-older{display:block;margin:0 auto 16px;border:1px solid #d9cabd;border-radius:999px;padding:7px 13px;background:#fff;color:#795f53}.class-error{padding:28px}.class-error button{float:right;border:0;background:none;font-size:25px}
    .unread-count{margin-left:auto;min-width:19px;padding:2px 5px;border-radius:999px;background:#df6534;color:#fff;font:700 11px/1.4 sans-serif;text-align:center}
    @keyframes messageFocus{0%,100%{background:transparent}35%{background:#ffe1c7}}
    @media(max-width:720px){.class-dialog{width:100%;height:100dvh;max-width:none;max-height:none;border-radius:0}.class-shell{display:block}.class-rail{height:auto;max-height:156px}.class-rail-head{min-height:52px}.class-list{display:flex;overflow-x:auto}.class-list>button{min-width:150px}.class-join{display:none}.class-shell.no-classes .class-join{display:flex}.class-main{height:calc(100% - 156px)}.today-homework{padding:9px}.class-homework{align-items:flex-start;flex-wrap:wrap}.class-homework button{margin-left:auto}.message-stream{padding:12px}.message-row>div:nth-child(2){max-width:82%}.message-avatar{width:34px;height:34px}.message-compose{min-height:66px;padding:9px}.assignment-center{padding:20px 14px}.assignment-row{grid-template-columns:1fr auto}.assignment-row>div:nth-child(2){grid-column:1;text-align:left}.assignment-row>button{grid-column:2;grid-row:1/3}.chat-search{grid-template-columns:1fr}.chat-search input:first-child{grid-column:auto}}
    @media(prefers-reduced-motion:reduce){.message-focus{animation:none;outline:3px solid #df6534}}
  `; document.head.append(style);
  window.MusicHomework = { open, openAssignments };
})();
