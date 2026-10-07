(() => {
  'use strict';
  const $ = id => document.getElementById(id), E = window.MusicVocal.TunerEngine;
  let instrument = 'guitar', lesson = null, session = null, lessonToken = null, lessonGeneration = 0;
  function parseTargets(value) {
    const values = String(value || '').split(/[,，\s]+/).filter(Boolean);
    if (!values.length || values.length > 12) return null;
    const notes = values.map(value => E.parseTarget(value));
    return notes.every(Boolean) ? [...new Set(notes.map(note => note.note))] : null;
  }
  function showInstrument(next) {
    instrument = next === 'erhu' ? 'erhu' : 'guitar';
    for (const name of ['guitar', 'erhu']) $(name).classList.toggle('hidden', name !== instrument);
    document.querySelectorAll('[data-instrument]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.instrument === instrument)));
    window.dispatchEvent(new CustomEvent('musictoolbox:pagechange', { detail: { id: instrument } }));
  }
  function chooseTarget(note, index) {
    showInstrument(lesson.instrument);
    window.MusicVocal.tuner.selectTarget(note, lesson.instrument);
    $('lessonTargets').querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  }
  function renderLesson(value, url) {
    lesson = value; $('saveTuning').hidden = !lessonToken; $('tuningSaveStatus').textContent = ''; $('tuningLogin').hidden = true; session = new window.MusicVocal.TuningSession(value.targets, value.instrument); updateProgress(); $('lessonCard').hidden = false; $('lessonTitle').textContent = value.title;
    $('lessonTargets').replaceChildren();
    value.targets.forEach((note, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = `${index + 1}. ${note}`;
      button.onclick = () => chooseTarget(note, index); $('lessonTargets').append(button);
    });
    $('lessonLink').textContent = url; chooseTarget(value.targets[0], 0);
  }
  function updateProgress() {
    if (!session) return;
    const summaries = session.summary();
    $('lessonProgress').textContent = `稳定完成 ${session.completed()}/${summaries.length} 个目标音。` + summaries.filter(row => row.samples).map(row => `${row.note}：${row.samples} 次有效检测，平均${row.meanCents === 0 ? '偏差 0' : (row.meanCents < 0 ? '偏低 ' : '偏高 ') + Math.abs(row.meanCents)} 音分`).join('；');
  }
  window.addEventListener('haitang:tuner-reading', event => {
    if (session && session.add(event.detail)) updateProgress();
  });
  $('exportTuning').onclick = () => {
    if (!session || !lesson) return;
    const report = { title: lesson.title, instrument: lesson.instrument, completed: session.completed(), summary: session.summary(), description: '本次设备检测摘要，不包含录音。' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = '调音练习记录.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  window.addEventListener('haitang:tuner-target', event => {
    if (!lesson) return;
    $('lessonTargets').querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(lesson.instrument === event.detail.instrument && lesson.targets[i] === event.detail.note)));
  });
  document.querySelectorAll('[data-instrument]').forEach(button => button.onclick = () => showInstrument(button.dataset.instrument));
  document.querySelectorAll('[data-public-back]').forEach(button => button.onclick = () => { window.MusicVocal.tuner.stop(); location.href = 'index.html?product=music'; });
  const params = new URLSearchParams(location.search), targets = parseTargets(params.get('targets') || params.get('note'));
  showInstrument(params.get('instrument'));
  if (!params.has('lesson') && targets) renderLesson({ title: (params.get('title') || '老师的调音练习').slice(0,80), targets, instrument }, location.href);
  else if (!params.has('lesson') && (params.has('targets') || params.has('note'))) $('shareStatus').textContent = '分享链接中的目标音无效，已打开普通调音器。';
  async function readApi(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const data = await response.json().catch(() => { throw new Error('暂时无法读取练习服务，请稍后重试。'); });
    if (!response.ok) throw new Error(data.error || '暂时无法连接，请稍后重试。');
    return data;
  }
  if (params.has('lesson')) {
    const generation = lessonGeneration;
    $('lessonLoadStatus').textContent = '正在读取老师的练习…';
    readApi(`/api/tuning/${encodeURIComponent(params.get('lesson'))}`).then(data => {
      if (generation !== lessonGeneration) return;
      const value = data.lesson, parsed = parseTargets(value?.targets?.join(','));
      if (!parsed || !['guitar', 'erhu'].includes(value.instrument)) throw new Error('老师的练习内容无效。');
      lessonToken = value.token; renderLesson({ ...value, targets: parsed }, location.href);
      $('lessonLoadStatus').textContent = '老师的练习已打开。调音无需登录，保存给老师需要班级账号。';
    }).catch(error => { if (generation !== lessonGeneration) return; $('lessonLoadStatus').textContent = error.message + ' 仍可使用普通调音器。'; });
  }
  $('saveTuning').onclick = async () => {
    if (!lessonToken || !session) return;
    const button = $('saveTuning'); button.disabled = true;
    const summary = session.summary(), token = lessonToken, currentSession = session;
    try {
      const account = await readApi('/api/auth/session');
      if (!account.user) { $('tuningLogin').hidden = false; throw new Error('请打开登录页面并加入老师班级，再回到此页保存。当前记录会保留，也可以先导出。'); }
      $('tuningLogin').hidden = true;
      const csrf = await readApi('/api/csrf');
      await readApi(`/api/tuning/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken }, body: JSON.stringify({ consent: true, userId: account.user.id, summary }) });
      if (session !== currentSession || lessonToken !== token) return;
      $('tuningSaveStatus').textContent = `已保存当前摘要：稳定完成 ${summary.filter(row => row.samples >= 3 && row.stableCount > 0).length}/${summary.length} 个目标音。继续练习后可再次保存更新。`;
    } catch (error) { if (session === currentSession && lessonToken === token) $('tuningSaveStatus').textContent = error.message; }
    finally { button.disabled = false; }
  };
  if (params.get('share') === '1') $('shareDetails').open = true;
  $('shareInstrument').onchange = () => { $('shareTargets').value = $('shareInstrument').value === 'erhu' ? 'D4,A4' : 'E2,A2,D3,G3,B3,E4'; };
  $('shareForm').onsubmit = event => {
    event.preventDefault(); const selected = parseTargets($('shareTargets').value);
    if (!selected) { $('shareStatus').textContent = '请输入 1–12 个 C2–C6 目标音，例如 E2,A2,D3。'; return; }
    const value = { title: $('shareTitle').value.trim().slice(0,80) || '本周调音练习', targets: selected, instrument: $('shareInstrument').value };
    const url = new URL('tuner.html', document.baseURI);
    url.searchParams.set('title', value.title); url.searchParams.set('instrument', value.instrument); url.searchParams.set('targets', selected.join(','));
    $('shareLink').hidden = false; $('shareLink').value = url.href; $('copyLesson').disabled = $('printLesson').disabled = false;
    lessonGeneration++; $('lessonLoadStatus').textContent = ''; lessonToken = null; renderLesson(value, url.href); $('shareStatus').textContent = '分享卡已生成，可复制链接或打印。';
  };
  $('copyLesson').onclick = async () => {
    try { await navigator.clipboard.writeText($('shareLink').value); $('shareStatus').textContent = '已复制，可发给学生。'; }
    catch (_) { $('shareLink').focus(); $('shareLink').select(); $('shareStatus').textContent = '请复制已选中的链接。'; }
  };
  $('printLesson').onclick = () => { window.MusicVocal.tuner.stop(); window.print(); };
})();
