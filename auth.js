(() => {
  'use strict';
  let csrfToken = '', user = null;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const roleName = { learner: '学习者', teacher: '教师', admin: '管理员' };
  const dialog = document.createElement('dialog'); dialog.className = 'auth-dialog'; document.body.append(dialog);
  const accountBox = () => document.getElementById('eduSettingsAccount');

  async function csrf() { if (csrfToken) return csrfToken; const r = await fetch('/api/csrf'); csrfToken = (await r.json()).csrfToken; return csrfToken; }
  async function api(url, options = {}) {
    const method = options.method || 'GET', headers = { ...(options.headers || {}) };
    if (!['GET', 'HEAD'].includes(method)) headers['x-csrf-token'] = await csrf();
    const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    const body = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || body?.error || '请求失败'); return body;
  }

  function toast(message, error = false) {
    const fn = window.HetianEducationUI?.showToast;
    if (typeof fn === 'function') return fn(message, error);
    window.alert(message);
  }

  function notifyAccessChange() {
    window.dispatchEvent(new CustomEvent('hetian:auth-changed', { detail: { user } }));
  }

  function renderAccountUI() {
    const box = accountBox(); if (!box) return;
    if (!user) {
      box.innerHTML = '<p class="settings-muted">当前为访客模式，学习数据仅保存在本机。登录后可跨设备同步作业与学习档案。</p><div class="settings-actions"><button class="edu-button primary" type="button" data-auth="login">登录</button><button class="edu-button ghost" type="button" data-auth="register">注册</button></div>';
    } else {
      const initial = esc((user.username || user.email || '?').charAt(0).toUpperCase());
      box.innerHTML = `<div class="account-status"><div class="account-avatar">${initial}</div><div><b>${esc(user.username || '')}</b><small>${esc(user.email || '')} · ${roleName[user.role] || user.role}</small></div></div><div class="settings-actions"><button class="edu-button ghost" type="button" data-auth="account">账户中心</button><button class="edu-button ghost" type="button" data-auth="homework">我的作业</button><button class="edu-button danger" type="button" data-auth="logout">退出登录</button></div>`;
    }
    box.querySelectorAll('[data-auth]').forEach(button => button.addEventListener('click', onAuthAction));
  }

  async function onAuthAction(event) {
    const mode = event.currentTarget.dataset.auth;
    try {
      if (mode === 'login') return open('login');
      if (mode === 'register') return open('register');
      if (mode === 'account') return openAccount().catch(error => toast(error.message, true));
      if (mode === 'homework') return window.MusicHomework?.open();
      if (mode === 'logout') {
        try { await api('/api/auth/logout', { method: 'POST' }); } finally { user = null; csrfToken = ''; }
        renderAccountUI();
        notifyAccessChange();
        toast('已退出登录');
      }
    } catch (error) {
      toast(error.message, true);
    }
  }

  function open(mode) {
    const registering = mode === 'register';
    const forgot = mode === 'forgot';
    dialog.innerHTML = `<form class="auth-card" method="dialog"><h2>${registering ? '创建账号' : forgot ? '找回密码' : '用户登录'}</h2><p>${registering ? '注册后需要通过邮件验证。' : forgot ? '我们会把重置链接发送到注册邮箱。' : '使用邮箱或原有用户名登录。'}</p>${registering ? '<label>昵称</label><input name="username" autocomplete="nickname" minlength="2" maxlength="40" required>' : ''}<label>${registering || forgot ? '邮箱' : '邮箱或用户名'}</label><input name="email" ${registering || forgot ? 'type="email"' : ''} autocomplete="username" maxlength="254" required>${forgot ? '' : `<label>密码</label><input name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="${registering ? 10 : 1}" required>`}<div class="auth-message"></div>${!registering&&!forgot?'<div class="auth-links"><button type="button" data-forgot>忘记密码</button><button type="button" data-resend>重发验证邮件</button></div>':''}<div class="auth-actions"><button class="cancel" value="cancel" formnovalidate>取消</button><button class="submit" value="submit">${registering ? '注册' : forgot ? '发送重置邮件' : '登录'}</button></div></form>`;
    const form = dialog.querySelector('form');
    form.addEventListener('submit', async (event) => {
      if (event.submitter?.value !== 'submit') return; event.preventDefault(); const message = form.querySelector('.auth-message'); message.textContent = '';
      try { const data = Object.fromEntries(new FormData(form)); const endpoint=registering?'register':forgot?'forgot-password':'login'; const body = await api(`/api/auth/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); if(registering||forgot){message.className='auth-message success';message.innerHTML=body.mail?.devLink?`本机测试链接：<a href="${esc(body.mail.devLink)}">打开</a>`:body.devLink?`本机测试链接：<a href="${esc(body.devLink)}">打开</a>`:registering?'验证邮件已发送，请查收。':'如果邮箱存在，重置邮件已经发送。';return;} user = body.user; csrfToken = body.csrfToken; renderAccountUI(); notifyAccessChange(); dialog.close(); toast('登录成功'); } catch (error) { message.textContent = error.message; }
    }); dialog.showModal();
    form.querySelector('[data-forgot]')?.addEventListener('click',()=>open('forgot'));
    form.querySelector('[data-resend]')?.addEventListener('click',async()=>{const email=form.elements.email.value,message=form.querySelector('.auth-message');if(!email)return message.textContent='请先输入注册邮箱';const body=await api('/api/auth/resend-verification',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});message.className='auth-message success';message.innerHTML=body.devLink?`本机测试链接：<a href="${esc(body.devLink)}">打开</a>`:'如果邮箱存在且尚未验证，邮件已经发送。';});
  }
  async function openAccount() {
    const { systems } = await api('/api/auth/systems');
    const byCode = Object.fromEntries(systems.map((item) => [item.system_code, item]));
    const hobby = byCode.hobby || { role: 'learner', profile: {} };
    const gaokao = byCode.gaokao || { role: 'learner', profile: {} };
    dialog.innerHTML = `<div class="auth-card account-center"><button class="account-close" type="button">×</button><h2>账户中心</h2><p>${esc(user.email || '')}</p>
      <form data-system="hobby"><h3>音乐爱好者系统 <span>${roleName[hobby.role] || hobby.role}</span></h3><label>姓名<input name="name" value="${esc(hobby.profile.name)}"></label><label>乐器<input name="instrument" value="${esc(hobby.profile.instrument || '吉他')}"></label><label>年龄<input name="age" type="number" min="3" max="120" value="${esc(hobby.profile.age)}"></label><label>每天学习时间（分钟）<input name="dailyMinutes" type="number" min="5" max="480" value="${esc(hobby.profile.dailyMinutes || 30)}"></label><button class="submit">保存爱好者档案</button><div class="auth-message"></div></form>
      <form data-system="gaokao"><h3>高考音乐生系统 <span>${roleName[gaokao.role] || gaokao.role}</span></h3><label>姓名<input name="name" value="${esc(gaokao.profile.name)}"></label><label>考试日期<input name="examDate" type="date" value="${esc(gaokao.profile.examDate)}"></label><label>未来方向<input name="direction" value="${esc(gaokao.profile.direction)}"></label><label>主项<input name="primaryMajor" value="${esc(gaokao.profile.primaryMajor)}"></label><label>副项<input name="secondaryMajor" value="${esc(gaokao.profile.secondaryMajor)}"></label><label>考试省份<input name="province" value="${esc(gaokao.profile.province || '广东省')}"></label><button class="submit">保存高考档案</button><div class="auth-message"></div></form></div>`;
    dialog.querySelector('.account-close').onclick = () => dialog.close();
    dialog.querySelectorAll('form[data-system]').forEach((form) => {
      form.onsubmit = async (event) => {
        event.preventDefault();
        const message = form.querySelector('.auth-message');
        const profile = Object.fromEntries(new FormData(form));
        if (profile.age) profile.age = Number(profile.age);
        if (profile.dailyMinutes) profile.dailyMinutes = Number(profile.dailyMinutes);
        try {
          await api(`/api/auth/systems/${form.dataset.system}/profile`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile }) });
          message.className = 'auth-message success'; message.textContent = '已保存';
        } catch (error) { message.className = 'auth-message'; message.textContent = error.message; }
      };
    });
    dialog.showModal();
  }
  async function handleAccountAction(){
    const params=new URLSearchParams(location.search),action=params.get('accountAction'),token=params.get('token');if(!action||!token)return;
    if(action==='verify'){
      dialog.innerHTML='<div class="auth-card"><h2>邮箱验证</h2><p class="auth-message">正在验证…</p><div class="auth-actions"><button class="submit" data-done>返回登录</button></div></div>';dialog.showModal();const message=dialog.querySelector('.auth-message');try{await api('/api/auth/verify-email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});message.className='auth-message success';message.textContent='邮箱验证成功，现在可以登录。';history.replaceState({},'',location.pathname);}catch(error){message.textContent=error.message;}dialog.querySelector('[data-done]').onclick=()=>{dialog.close();open('login')};return;
    }
    if(action==='reset'){
      dialog.innerHTML='<form class="auth-card"><h2>设置新密码</h2><label>新密码</label><input name="password" type="password" minlength="10" autocomplete="new-password" required><div class="auth-message"></div><div class="auth-actions"><button class="submit">保存新密码</button></div></form>';dialog.showModal();dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const message=event.currentTarget.querySelector('.auth-message');try{await api('/api/auth/reset-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,password:event.currentTarget.elements.password.value})});message.className='auth-message success';message.textContent='密码已重置，请重新登录。';history.replaceState({},'',location.pathname);setTimeout(()=>open('login'),700);}catch(error){message.textContent=error.message;}};
    }
  }
  window.HetianAuth = {
    getUser: () => user,
    renderAccountUI,
    openLogin: () => open('login'),
    openRegister: () => open('register'),
    openAccount: () => openAccount(),
    openHomework: () => window.MusicHomework?.open(),
    logout: () => onAuthAction({ currentTarget: { dataset: { auth: 'logout' } } })
  };
  api('/api/auth/session').then((body) => { user = body.user; renderAccountUI(); notifyAccessChange(); }).catch(() => {});
  handleAccountAction();
  import('/homework.js').catch(() => {});
})();
