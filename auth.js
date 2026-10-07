(() => {
  'use strict';
  let csrfToken = '', user = null, resolveReady, applyingCloudState = false;
  const syncTimers = {};
  let syncRevision = null, syncStatus = 'guest', syncError = '', syncEpoch = 0, syncFlight = Promise.resolve();
  const syncKey = (id = user?.id) => `haitang_sync_${systemCode}_${id || 0}`;
  function setSyncStatus(status, error = '') {
    syncStatus = status; syncError = error;
    const label = document.getElementById('accountSyncStatus');
    if (label) label.textContent = ({synced:'已同步',pending:'待同步',syncing:'正在同步',failed:'同步失败',conflict:'数据冲突，需要选择保留版本',guest:'未登录，仅保存在本机'})[status] + (error ? `：${error}` : '');
    window.dispatchEvent(new CustomEvent('hetian:sync-status', {detail:{status,error}}));
  }
  function syncMarker(dirty) { if (user) localStorage.setItem(syncKey(), JSON.stringify({revision:syncRevision,dirty})); }

  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const product = window.HaitangProduct?.product === 'exam' ? 'exam' : 'music';
  const systemCode = product === 'exam' ? 'gaokao' : 'hobby';
  const productName = product === 'exam' ? '海棠艺考' : '海棠音乐';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const roleName = { learner: product === 'exam' ? '学生' : '用户', teacher: '教师', admin: '总管理员教师' };
  const dialog = document.createElement('dialog'); dialog.className = 'auth-dialog'; document.body.append(dialog);
  const accountBox = () => document.getElementById('eduSettingsAccount');

  async function csrf() { if (csrfToken) return csrfToken; const r = await fetch('/api/csrf'); csrfToken = (await r.json()).csrfToken; return csrfToken; }
  async function api(url, options = {}) {
    const method = options.method || 'GET', headers = { ...(options.headers || {}) };
    if (!['GET', 'HEAD'].includes(method)) headers['x-csrf-token'] = await csrf();
    const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    const body = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(body?.message || body?.error || '请求失败'); error.status = response.status; error.body = body; throw error; } return body;
  }

  function toast(message, error = false) {
    const fn = window.HetianEducationUI?.showToast;
    if (typeof fn === 'function') return fn(message, error);
    window.alert(message);
  }

  function notifyAccessChange() {
    window.dispatchEvent(new CustomEvent('hetian:auth-changed', { detail: { user } }));
  }

  function announceSessionChange() {
    localStorage.setItem('haitang_auth_changed_at', `${Date.now()}:${user?.id || 0}`);
  }

  const localState = (code) => code === 'gaokao'
    ? window.GaokaoStore?.getState?.()
    : window.HetianEducation?.getState?.();

  function hasLearningData(code, state) {
    if (!state || typeof state !== 'object') return false;
    if (code === 'gaokao') {
      return Boolean(state.profile?.completed && state.profile?.name)
        || Number(state.learning?.totalQuestions) > 0 || (state.sessions?.length || 0) > 0;
    }
    return Boolean(state.onboarding?.completed && state.profile?.username)
      || Number(state.learning?.totalQuestions) > 0 || (state.sessions?.length || 0) > 0;
  }

  function applyProfile(code, profile = {}) {
    if (!profile?.name) return;
    if (code === 'gaokao') {
      window.GaokaoStore?.saveProfile?.({
        name: profile.name, examDate: profile.examDate || '', province: profile.province || '广东省',
        direction: profile.direction || '', primarySubject: profile.primarySubject || profile.primaryMajor || '',
        secondarySubject: profile.secondarySubject || profile.secondaryMajor || ''
      });
    } else {
      window.HetianEducation?.saveProfile?.({
        username: profile.name, primaryMajor: profile.instrument || '吉他', age: Number(profile.age) || 0,
        dailyMinutes: Number(profile.dailyMinutes) || 30, examDirection: ['海棠音乐']
      });
    }
  }

  function applyState(code, state) {
    if (!state || typeof state !== 'object') return;
    if (code === 'gaokao') window.GaokaoStore?.update?.(() => state);
    else window.HetianEducation?.saveEducationState?.(state);
  }

  function resetLocalState(code = systemCode) {
    if (code === 'gaokao') window.GaokaoStore?.update?.(() => ({}));
    else window.HetianEducation?.resetEducationState?.();
  }

  function clearAccountCache() {
    syncEpoch++; syncRevision = null; setSyncStatus('guest');
    clearTimeout(syncTimers[systemCode]);
    delete syncTimers[systemCode];
    applyingCloudState = true;
    try {
      resetLocalState();
      localStorage.removeItem(`haitang_state_owner_${systemCode}`);
    } finally {
      applyingCloudState = false;
    }
  }

  async function pushState(code, accountId = user?.id) {
    const epoch = syncEpoch;
    const task = async () => {
      if (!user || String(user.id) !== String(accountId) || epoch !== syncEpoch || code !== systemCode) return;
      if (syncStatus === 'conflict') return;
      const state = localState(code); if (!state) return;
      const captured = JSON.stringify(state); setSyncStatus('syncing');
      try {
        const result = await api(`/api/auth/state/${code}`, { method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify({state,userId:accountId,expectedRevision:syncRevision}) });
        if (epoch !== syncEpoch || String(user?.id) !== String(accountId)) return;
        syncRevision = result.revision;
        const dirty = captured !== JSON.stringify(localState(code)); syncMarker(dirty);
        setSyncStatus(dirty ? 'pending' : 'synced');
        if (dirty) queueStateSync(code);
      } catch (error) {
        if (epoch !== syncEpoch || String(user?.id) !== String(accountId)) return;
        syncMarker(true); setSyncStatus(error.body?.conflict ? 'conflict' : 'failed', error.message);
        throw error;
      }
    };
    const result = syncFlight.catch(() => {}).then(task); syncFlight = result; return result;
  }

  function queueStateSync(code) {
    if (applyingCloudState || !user || code !== systemCode) return;
    syncMarker(true); if (syncStatus === 'conflict') return;
    setSyncStatus('pending'); clearTimeout(syncTimers[code]);
    const accountId = user.id;
    syncTimers[code] = setTimeout(() => pushState(code, accountId).catch(() => {}), 700);
  }

  async function hydrateAccountState(accountUser) {
    if (!accountUser) return;
    clearTimeout(syncTimers[systemCode]);
    delete syncTimers[systemCode];
    const epoch = ++syncEpoch; setSyncStatus('syncing');
    applyingCloudState = true;
    try {
      const ownerKey = `haitang_state_owner_${systemCode}`;
      const owner = localStorage.getItem(ownerKey);
      const sameOwner = owner === String(accountUser.id);
      if (!sameOwner) resetLocalState();

      const cloud = await api(`/api/auth/state/${systemCode}`);
      if (epoch !== syncEpoch || String(user?.id) !== String(accountUser.id)) return;
      if (String(cloud.userId) !== String(accountUser.id)) throw new Error('登录账号已改变，请重新载入后同步。');
      let marker = null; try { marker = JSON.parse(localStorage.getItem(syncKey(accountUser.id)) || 'null'); } catch {}
      if (sameOwner && marker?.dirty) {
        syncRevision = marker.revision ?? null;
        if (syncRevision !== cloud.revision) setSyncStatus('conflict'); else setSyncStatus('pending');
        return;
      }
      syncRevision = cloud.revision ?? null;
      const accountProfile = accountUser.profiles?.[systemCode] || {};
      const cloudBelongsToAccount = String(cloud.userId) === String(accountUser.id);
      if (!cloudBelongsToAccount) throw new Error('登录账号已改变，请重新载入后同步。');

      if (hasLearningData(systemCode, cloud.state) && cloudBelongsToAccount) {
        applyState(systemCode, cloud.state);
      } else if (hasLearningData(systemCode, cloud.state)) {
        resetLocalState();
      }
      applyProfile(systemCode, accountProfile);
      localStorage.setItem(ownerKey, String(accountUser.id));

      const state = localState(systemCode);
      if ((!cloudBelongsToAccount || !hasLearningData(systemCode, cloud.state)) && hasLearningData(systemCode, state)) {
        await pushState(systemCode, accountUser.id);
      } else { syncMarker(false); setSyncStatus('synced'); }
    } catch (error) { setSyncStatus('failed', error.message); throw error; } finally {
      applyingCloudState = false;
      if (syncStatus === 'pending') queueStateSync(systemCode);
    }
  }

  async function saveAccountProfile(code, profile) {
    const result = await api(`/api/auth/systems/${code}/profile`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile }) });
    user.profiles = { ...(user.profiles || {}), [code]: result.profile };
    applyingCloudState = true;
    try { applyProfile(code, result.profile); } finally { applyingCloudState = false; }
    await pushState(code);
    return result.profile;
  }

  function renderAccountUI() {
    const box = accountBox(); if (!box) return;
    const accountUser = user || null;
    if (!accountUser) {
      box.innerHTML = `<p class="settings-muted">当前未登录 ${productName}。${product === 'exam' ? '登录后可保存训练、成绩和作业。' : '登录后可保存学习进度和会员状态。'}</p><div class="settings-actions"><button class="edu-button primary" type="button" data-auth="login">登录</button><button class="edu-button ghost" type="button" data-auth="register">注册</button></div>`;
    } else {
      const initial = esc((accountUser.username || accountUser.email || '?').charAt(0).toUpperCase());
      box.innerHTML = `<div class="account-status"><div class="account-avatar">${initial}</div><div><b>${esc(accountUser.username || '')}</b><small>${esc(accountUser.email || '')} · ${roleName[accountUser.role] || accountUser.role}</small></div></div><div class="settings-actions"><button class="edu-button ghost" type="button" data-auth="account">账户中心</button>${product === 'exam' ? '<button class="edu-button ghost" type="button" data-auth="homework">我的作业</button>' : ''}${accountUser.role === 'admin' ? '<button class="edu-button ghost" type="button" data-auth="issue-license">签发体验权益</button><button class="edu-button ghost" type="button" data-auth="tuner-experience">调音体验统计</button>' : ''}<button class="edu-button danger" type="button" data-auth="logout">退出登录</button></div>`;
    }
    const status = document.createElement('p'); status.id = 'accountSyncStatus'; status.setAttribute('role','status'); box.append(status);
    if (user) {
      const actions = document.createElement('div'); actions.className = 'settings-actions';
      actions.innerHTML = '<button type="button" class="edu-button ghost" data-sync-retry>重试同步</button><button type="button" class="edu-button ghost" data-sync-resolve>恢复或处理冲突</button>';
      actions.querySelector('[data-sync-retry]').onclick = () => pushState(systemCode).catch(error => toast(error.message, true));
      actions.querySelector('[data-sync-resolve]').onclick = () => openSyncRecovery().catch(error => toast(error.message, true)); box.append(actions);
    }
    setSyncStatus(syncStatus, syncError);
    box.querySelectorAll('[data-auth]').forEach(button => button.addEventListener('click', onAuthAction));
  }

  async function openTunerExperienceReport() {
    if (user?.role !== 'admin') return;
    const accountId = user.id;
    dialog.innerHTML='<section class="auth-card"><h2>调音体验统计</h2><p>自愿参与的调音尝试次数，非用户人数；不含录音和账号。样本有自选偏差，不能代表所有设备的精度。</p><div data-experience-report>正在读取近30天汇总…</div><button type="button" data-close>关闭</button></section>';
    dialog.querySelector('[data-close]').onclick=()=>dialog.close(); dialog.showModal();
    const box=dialog.querySelector('[data-experience-report]');
    const current=()=>user?.id===accountId && user?.role==='admin' && dialog.open && box.isConnected;
    try {
      const data=await api('/api/admin/tuner-experience');
      if(!current())return;
      const groups=new Map(), platforms={ios:'iPhone / iPad',android:'安卓',desktop:'电脑',other:'其他'}, browsers={safari:'Safari',chrome:'Chrome',firefox:'Firefox',edge:'Edge',other:'其他'};
      const failures={permission:'未授权',no_device:'未找到麦克风',device_busy:'设备占用',unsupported:'不支持',unknown:'其他失败'}, failureCounts={};
      for(const item of data.items||[]) {
        const key=item.platform+'/'+item.browser;
        if(!groups.has(key))groups.set(key,{platform:item.platform,browser:item.browser,stable:0,no_stable:0,input_failed:0,cancelled:0});
        groups.get(key)[item.result]+=item.count;
        if(item.failure!=='none')failureCounts[item.failure]=(failureCounts[item.failure]||0)+item.count;
      }
      box.innerHTML=groups.size?`<p>按设备与浏览器统计；“稳定”表示至少出现一次设备判定的稳定音高。</p><div style="overflow:auto"><table><thead><tr><th>设备 / 浏览器</th><th>稳定</th><th>未稳定</th><th>开启失败</th><th>取消开启</th></tr></thead><tbody>${[...groups.values()].map(row=>`<tr><td>${esc(platforms[row.platform])} / ${esc(browsers[row.browser])}</td><td>${row.stable}</td><td>${row.no_stable}</td><td>${row.input_failed}</td><td>${row.cancelled}</td></tr>`).join('')}</tbody></table></div><p>开启失败：${Object.entries(failureCounts).map(([key,count])=>esc(failures[key])+count+'次').join('；')||'暂无'}</p>`:'暂无自愿提交的体验统计。';
    } catch(error) { if(current())box.textContent=error.message; }
  }

  function openEntitlementIssuer() {
    if (user?.role !== 'admin') return;
    const accountId=user.id;
    dialog.innerHTML='<form class="auth-card"><h2>签发体验权益</h2><p>权益绑定兑换账号。此处不收取费用，也不会授予服务器管理员身份。</p><label>方案<select name="plan"><option value="student_pro">学生专业版</option><option value="ai_teacher">AI 教师版</option><option value="teacher">教师版</option></select></label><label>有效天数<input name="days" type="number" min="1" max="366" value="30" required></label><div class="auth-actions"><button type="submit">签发兑换码</button><button type="button" data-close>关闭</button></div><p class="auth-message" role="status"></p></form>';
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    const form=dialog.querySelector('form');
    form.onsubmit=async event=>{
      event.preventDefault();if(user?.id!==accountId)return;
      const button=form.querySelector('[type="submit"]'), message=form.querySelector('.auth-message');button.disabled=true;
      try {
        const result=await api('/api/admin/entitlements',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({plan:form.elements.plan.value,days:Number(form.elements.days.value)})});
        if(user?.id!==accountId)return;
        message.textContent=`兑换码：${result.code}。有效至 ${new Date(result.expiresAt).toLocaleDateString()}，请保存；关闭后不会再次显示原码。`;
      } catch(error){if(user?.id===accountId)message.textContent=error.message;}
      finally {button.disabled=false;}
    };
    dialog.showModal();
  }

  function exportSyncBackup() {
    const blob = new Blob([JSON.stringify({systemCode,userId:user?.id,state:localState(systemCode)},null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href=url; link.download=`海棠学习备份-${systemCode}-${Date.now()}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function openSyncRecovery() {
    if (!user) return;
    const accountId=user.id, epoch=syncEpoch, cloud=await api(`/api/auth/state/${systemCode}`);
    if(epoch!==syncEpoch || user?.id!==accountId)return;
    if(String(cloud.userId)!==String(accountId))throw new Error('登录账号已改变，请重新载入后同步。');
    dialog.innerHTML='<div class="auth-card"><h2>选择保留的学习数据</h2><p>另一台设备可能有更新。请先导出本机备份，再选择使用云端数据，或用本机数据更新云端。</p><div class="auth-actions"><button type="button" data-sync-export>导出本机备份</button><button type="button" data-sync-cloud>使用云端数据</button><button type="button" data-sync-local>用本机更新云端</button><button type="button" data-sync-close>暂不处理</button></div><p class="auth-message" role="status"></p></div>';
    const valid=()=>epoch===syncEpoch && user?.id===accountId;
    dialog.querySelector('[data-sync-export]').onclick=exportSyncBackup;
    dialog.querySelector('[data-sync-close]').onclick=()=>dialog.close();
    dialog.querySelector('[data-sync-cloud]').onclick=()=>{
      if(!valid())return; exportSyncBackup(); applyingCloudState=true;
      try { resetLocalState(); if(cloud.state)applyState(systemCode,cloud.state); syncRevision=cloud.revision??null; syncMarker(false);setSyncStatus('synced'); }
      finally {applyingCloudState=false;} dialog.close();
    };
    dialog.querySelector('[data-sync-local]').onclick=async()=>{
      if(!valid())return;exportSyncBackup();syncRevision=cloud.revision??null;setSyncStatus('pending');
      try {await pushState(systemCode,accountId);if(valid())dialog.close();}
      catch(error){if(valid())dialog.querySelector('.auth-message').textContent=error.message;}
    };
    dialog.showModal();
  }

  async function onAuthAction(event) {
    const mode = event.currentTarget.dataset.auth;
    try {
      if (mode === 'login') return open('login');
      if (mode === 'register') return open('register');
      if (mode === 'account') return openAccount().catch(error => toast(error.message, true));
      if (mode === 'tuner-experience') return openTunerExperienceReport();
      if (mode === 'issue-license') return openEntitlementIssuer();
      if (mode === 'homework') return window.MusicHomework?.open();
      if (mode === 'logout') {
        try { await api('/api/auth/logout', { method: 'POST' }); } finally { user = null; csrfToken = ''; }
        clearAccountCache();
        renderAccountUI();
        notifyAccessChange();
        announceSessionChange();
        toast('已退出登录');
      }
    } catch (error) {
      toast(error.message, true);
    }
  }

  function open(mode) {
    const registering = mode === 'register';
    const forgot = mode === 'forgot';
    dialog.innerHTML = `<form class="auth-card" method="dialog"><h2>${registering ? '注册海棠账号' : forgot ? '找回密码' : '登录海棠账号'}</h2><p>${registering ? '一个账号可使用海棠音乐和海棠艺考；两边的档案与进度分别保存。注册完成后将直接登录。' : forgot ? '我们会把重置链接发送到注册邮箱。' : '使用统一海棠账号登录。'}</p>${registering ? '<label>昵称</label><input name="username" autocomplete="nickname" minlength="2" maxlength="40" required>' : ''}<label>${registering || forgot ? '邮箱' : '邮箱或用户名'}</label><input name="email" ${registering || forgot ? 'type="email"' : ''} autocomplete="username" maxlength="254" required>${forgot ? '' : `<label>密码</label><input name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="${registering ? 10 : 1}" required>`}<div class="auth-message"></div>${!registering&&!forgot?'<div class="auth-links"><button type="button" data-forgot>忘记密码</button><button type="button" data-resend>重发验证邮件</button></div>':''}<div class="auth-actions"><button class="cancel" value="cancel" formnovalidate>取消</button><button class="submit" value="submit">${registering ? '注册并登录' : forgot ? '发送重置邮件' : '登录'}</button></div></form>`;
    const form = dialog.querySelector('form');
    form.addEventListener('submit', async (event) => {
      if (event.submitter?.value !== 'submit') return; event.preventDefault(); const message = form.querySelector('.auth-message'); message.textContent = '';
      try { const data = Object.fromEntries(new FormData(form)); data.learningSystem = systemCode; const endpoint=registering?'register':forgot?'forgot-password':'login'; const body = await api(`/api/auth/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); if(forgot){message.className='auth-message success';message.innerHTML=body.mail?.devLink?`本机测试链接：<a href="${esc(body.mail.devLink)}">打开</a>`:body.devLink?`本机测试链接：<a href="${esc(body.devLink)}">打开</a>`:'如果邮箱存在，重置邮件已经发送。';return;} user = body.user; csrfToken = body.csrfToken; let syncError = null; try { await hydrateAccountState(user); } catch (error) { syncError = error; } renderAccountUI(); notifyAccessChange(); announceSessionChange(); dialog.close(); toast(syncError ? `已登录，但学习数据同步失败：${syncError.message}` : registering?`已注册并登录${productName}`:`已登录${productName}`, Boolean(syncError)); } catch (error) { message.textContent = error.message; }
    }); dialog.showModal();
    form.querySelector('[data-forgot]')?.addEventListener('click',()=>open('forgot'));
    form.querySelector('[data-resend]')?.addEventListener('click',async()=>{const email=form.elements.email.value,message=form.querySelector('.auth-message');if(!email)return message.textContent='请先输入注册邮箱';const body=await api('/api/auth/resend-verification',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,learningSystem:systemCode})});message.className='auth-message success';message.innerHTML=body.devLink?`本机测试链接：<a href="${esc(body.devLink)}">打开</a>`:'如果邮箱存在且尚未验证，邮件已经发送。';});
  }
  async function openAccount() {
    const { systems } = await api('/api/auth/systems');
    const byCode = Object.fromEntries(systems.map((item) => [item.system_code, item]));
    const current = byCode[systemCode] || { role: 'learner', profile: {} };
    const fields = product === 'exam'
      ? `<label>姓名<input name="name" value="${esc(current.profile.name)}"></label><label>考试日期<input name="examDate" type="date" value="${esc(current.profile.examDate)}"></label><label>未来方向<input name="direction" value="${esc(current.profile.direction)}"></label><label>主项<input name="primaryMajor" value="${esc(current.profile.primaryMajor)}"></label><label>副项<input name="secondaryMajor" value="${esc(current.profile.secondaryMajor)}"></label><label>考试省份<input name="province" value="${esc(current.profile.province || '广东省')}"></label>`
      : `<label>姓名<input name="name" value="${esc(current.profile.name)}"></label><label>乐器<input name="instrument" value="${esc(current.profile.instrument || '吉他')}"></label><label>年龄<input name="age" type="number" min="3" max="120" value="${esc(current.profile.age)}"></label><label>每天学习时间（分钟）<input name="dailyMinutes" type="number" min="5" max="480" value="${esc(current.profile.dailyMinutes || 30)}"></label>`;
    dialog.innerHTML = `<div class="auth-card account-center"><button class="account-close" type="button">×</button><h2>${productName}账户</h2><p>${esc(user.email || '')} · ${roleName[current.role] || current.role}</p><form data-system="${systemCode}">${fields}<button class="submit">保存档案</button><div class="auth-message"></div></form></div>`;
    dialog.querySelector('.account-close').onclick = () => dialog.close();
    dialog.querySelectorAll('form[data-system]').forEach((form) => {
      form.onsubmit = async (event) => {
        event.preventDefault();
        const message = form.querySelector('.auth-message');
        const profile = Object.fromEntries(new FormData(form));
        if (profile.age) profile.age = Number(profile.age);
        if (profile.dailyMinutes) profile.dailyMinutes = Number(profile.dailyMinutes);
        try {
          await saveAccountProfile(form.dataset.system, profile);
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
    getSyncStatus: () => ({status:syncStatus,error:syncError}),
    retrySync: () => pushState(systemCode),
    openSyncRecovery,
    exportSyncBackup,
    renderAccountUI,
    openLogin: () => open('login'),
    openRegister: () => open('register'),
    openAccount: () => openAccount(),
    openHomework: () => window.MusicHomework?.open(),
    saveProfile: saveAccountProfile,
    logout: () => onAuthAction({ currentTarget: { dataset: { auth: 'logout' } } }),
    whenReady: () => ready
  };
  window.addEventListener('hetian:education-state', () => queueStateSync('hobby'));
  window.addEventListener('hetian:gaokao-state', () => queueStateSync('gaokao'));
  window.addEventListener('online', () => { if (user && ['pending','failed'].includes(syncStatus)) pushState(systemCode).catch(() => {}); });
  window.addEventListener('storage', event => {
    if (event.key === 'haitang_auth_changed_at') location.reload();
  });
  api('/api/auth/session').then(async (body) => {
    user = body.user;
    if (!user) clearAccountCache();
    try { await hydrateAccountState(user); } catch (error) { setSyncStatus('failed', error.message); console.warn('账号学习数据同步失败，暂时使用本机缓存。', error); }
    renderAccountUI(); notifyAccessChange(); resolveReady(user);
  }).catch(() => resolveReady(null));
  handleAccountAction();
  import('/homework.js?v=20261007-13').catch(() => {});
})();
