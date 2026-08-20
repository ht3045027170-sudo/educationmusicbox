(() => {
  'use strict';

  const Store = window.GaokaoStore;
  const App = window.HetianApp;
  if (!Store || !App) return;
  const $ = id => document.getElementById(id);
  const examBlueprints = window.HetianExamBlueprints;
  const examMode = id => {
    const blueprint = examBlueprints?.blueprints?.[id];
    if (!blueprint) return null;
    const types = examBlueprints.expand(blueprint);
    return { title:blueprint.title, minutes:blueprint.minutes, count:types.length, types, description:`${blueprint.sourceLabel}；共 ${types.length} 题。` };
  };
  const MODES = {
    single: { title:'单音听记', minutes:15, count:10, types:['single'], description:'每题连续播放一组单音，选择与声音完全一致的五线谱。' },
    interval: { title:'音程听记', minutes:15, count:10, types:['interval'], description:'听辨同时奏出的两个音，用五线谱确认实际音高位置。' },
    chord: { title:'和弦听记', minutes:15, count:10, types:['chord'], description:'听辨三和弦或七和弦，选择对应的五线谱纵向音组。' },
    rhythm: { title:'节奏听记', minutes:25, count:5, types:['rhythm'], description:'每题为完整节奏片段，依据拍号、时值和休止位置选择谱例。' },
    melody: { title:'旋律听记', minutes:25, count:5, types:['melody'], description:'听辨完整旋律片段，依据音高、节奏和小节位置选择谱例。' },
    comprehensive: { title:'综合听记', minutes:15, count:5, types:['single','interval','chord','rhythm','melody'], description:'单音、音程、和弦、节奏、旋律各一道，模拟快速综合判断。' },
    guangdong_mock: examMode('guangdong_mock') || { title:'广东音乐统考综合模拟', minutes:75, count:40, types:[...Array(14).fill('theory'),...Array(6).fill('single'),...Array(5).fill('interval'),...Array(5).fill('chord'),...Array(5).fill('rhythm'),...Array(5).fill('melody')], description:'原创模拟，共40题。' },
    xinghai_mock: examMode('xinghai_mock') || { title:'星海音乐学院校考机考模拟', minutes:50, count:40, types:[...Array(10).fill('single'),...Array(8).fill('interval'),...Array(8).fill('chord'),...Array(7).fill('rhythm'),...Array(7).fill('melody')], description:'原创校考模拟，共40题。' }
  };
  const LABELS = { theory:'乐理', single:'单音', interval:'音程', chord:'和弦', rhythm:'节奏', melody:'旋律' };
  if (MODES.guangdong_mock.types.length !== 40 || MODES.xinghai_mock.types.length !== 40 || MODES.xinghai_mock.types.includes('theory')) throw new Error('模拟考试题量配置错误');
  const INTERVALS = [1,2,3,4,5,6,7,8,9,10,11,12];
  const CHORDS = [[0,4,7],[0,3,7],[0,3,6],[0,4,8],[0,4,7,10],[0,4,7,11],[0,3,7,10]];
  let activeMode = 'single';
  let session = null;
  let timerId = 0;
  let questionShownAt = 0;

  const cloneNotes = notes => (notes || []).map(note => ({ ...note }));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const signature = notes => (notes || []).map(note => [Math.round(+note.midi || 0), +(+note.dur || 0).toFixed(5), note.rest ? 1 : 0, note.bar ?? ''].join('/')).join('|');
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const isCorrect = question => question.type === 'theory' ? question.selected === question.theory.answer : question.selected === signature(question.item.notes);

  function generateItem(type) {
    const item = App.generateEarItem?.(type);
    if (!item) throw new Error('听记出题引擎尚未准备好。');
    return { ...item, category:type, notes:cloneNotes(item.notes), _type:type };
  }

  function alternateNotes(item, attempt) {
    const notes = cloneNotes(item.notes);
    const type = item._type;
    if (type === 'interval') {
      const root = +item.root || +notes[0]?.midi || 60;
      const current = Math.abs((+notes[1]?.midi || root) - root);
      const distance = INTERVALS.filter(value => value !== current)[attempt % 11];
      return [{ midi:root, dur:2 }, { midi:clamp(root + distance, 55, 79), dur:2 }];
    }
    if (type === 'chord') {
      const root = +item.root || Math.min(...notes.map(note => +note.midi || 60));
      const current = signature(notes.map(note => ({ ...note, midi:(+note.midi || root) - root })));
      const candidates = CHORDS.filter(steps => signature(steps.map(midi => ({ midi, dur:2 }))) !== current);
      return candidates[attempt % candidates.length].map(step => ({ midi:clamp(root + step, 55, 79), dur:2 }));
    }
    if (type === 'rhythm') {
      const index = attempt % Math.max(1, notes.length);
      notes[index].rest = !notes[index].rest;
      return notes;
    }
    const pitched = notes.map((note, index) => ({ note, index })).filter(entry => !entry.note.rest);
    const selected = pitched[(attempt * 3 + 1) % pitched.length];
    const steps = [-2,-1,1,2,3,-3];
    selected.note.midi = clamp((+selected.note.midi || 60) + steps[attempt % steps.length], 55, 79);
    return notes;
  }

  function buildChoices(item) {
    const output = [{ notes:cloneNotes(item.notes), correct:true }];
    const seen = new Set([signature(item.notes)]);
    for (let attempt = 0; output.length < 4 && attempt < 80; attempt += 1) {
      const notes = alternateNotes(item, attempt);
      const key = signature(notes);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push({ notes, correct:false });
    }
    for (let index = output.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [output[index], output[other]] = [output[other], output[index]];
    }
    return output;
  }

  function modeCards() {
    $('gkDictationModes').innerHTML = Object.entries(MODES).map(([id, mode], index) => `
      <button class="gk-dictation-mode" type="button" data-dictation-mode="${id}">
        <i>${String(index + 1).padStart(2, '0')} / ${mode.minutes} MIN</i><b>${mode.title}</b><span>${mode.description}</span><small>${mode.count} 题 · 限时 ${mode.minutes} 分钟 →</small>
      </button>`).join('');
    $('gkDictationModes').querySelectorAll('[data-dictation-mode]').forEach(button => {
      button.addEventListener('click', () => openIntro(button.dataset.dictationMode));
    });
  }

  function showOnly(id) {
    ['gkDictationLanding','gkDictationIntro','gkDictationExam','gkDictationResult'].forEach(sectionId => $(sectionId).classList.toggle('hidden', sectionId !== id));
  }

  function open() {
    stopTimer();
    App.stopAllAudio?.('dictation-open');
    session = null;
    modeCards();
    showOnly('gkDictationLanding');
    App.showPage('gaokaoDictation');
  }

  function openIntro(modeId = activeMode) {
    activeMode = MODES[modeId] ? modeId : 'single';
    const mode = MODES[activeMode];
    $('gkDictationIntroTitle').textContent = mode.title;
    $('gkDictationIntroText').textContent = `${mode.description} 点击“开始学习”后立即计时；可提前提交，时间结束则自动交卷。考试中不会显示正确答案。`;
    $('gkDictationMinutes').textContent = String(mode.minutes);
    $('gkDictationCount').textContent = String(mode.count);
    showOnly('gkDictationIntro');
    App.showPage('gaokaoDictation');
  }

  async function ensureSamplePiano() {
    const piano = window.HetianPiano;
    if (!piano?.prepare || !App.getAudio) throw new Error('钢琴采样播放器未载入');
    await piano.prepare(App.getAudio());
    if (!piano.isReady?.()) throw new Error('钢琴采样尚未准备完成');
  }

  async function start() {
    const startButton = $('gkDictationStart');
    startButton.disabled = true;
    startButton.textContent = '正在载入钢琴采样…';
    try {
      await ensureSamplePiano();
    } catch (error) {
      console.error('听记钢琴采样载入失败。', error);
      $('gkDictationIntroText').textContent = '钢琴采样未能载入，请确认 sight-singing/piano-samples 文件夹完整后重试。听记考试不会使用低质量合成音色代替。';
      startButton.disabled = false;
      startButton.textContent = '重新载入钢琴采样';
      return;
    }
    startButton.disabled = false;
    startButton.textContent = '开始学习';
    const mode = MODES[activeMode];
    const types = mode.types.length === 1 ? Array(mode.count).fill(mode.types[0]) : [...mode.types];
    const allTheory = [...new Map([
      ...(window.GAOKAO_QUESTION_BANK?.questions || []).filter(item => item.domain === 'theory'),
      ...(window.GAOKAO_THEORY_BANK?.questions || []),
      ...(window.GAOKAO_EXTRA_THEORY_BANK?.questions || [])
    ].filter(item => Array.isArray(item.options) && item.options.length).map(item => [item.id, item])).values()];
    const approvedTheory = allTheory.filter(item => item.reviewStatus === 'approved');
    const theoryPool = (activeMode === 'guangdong_mock' ? approvedTheory : allTheory).sort(() => Math.random() - .5);
    if (types.includes('theory') && !theoryPool.length) {
      $('gkDictationIntroText').textContent = '乐理题库未载入，请确认 gaokao_system/database 文件完整后重试。';
      return;
    }
    const questions = types.map((type, index) => {
      if (type === 'theory') {
        const theory = theoryPool[index % theoryPool.length];
        return { id:`gk-mock-theory-${Date.now()}-${index}`, type, theory, choices:[...theory.options].sort(() => Math.random() - .5), selected:'', responseTime:0 };
      }
      const item = generateItem(type);
      return { id:`gk-dict-${Date.now()}-${index}`, item, choices:buildChoices(item), selected:'', responseTime:0 };
    });
    session = {
      id:`gk-dictation-${Date.now()}`, mode:activeMode, questions, index:0,
      startedAt:Date.now(), deadline:Date.now() + mode.minutes * 60000, durationSeconds:mode.minutes * 60,
      submitted:false, timedOut:false
    };
    $('gkDictationModeLabel').textContent = mode.title;
    showOnly('gkDictationExam');
    renderQuestion();
    startTimer();
  }

  function renderQuestion() {
    if (!session) return;
    App.stopAllAudio?.('dictation-question-change');
    const question = session.questions[session.index];
    const type = question.type || question.item._type;
    questionShownAt = Date.now();
    $('gkDictationCounter').textContent = `${session.index + 1} / ${session.questions.length}`;
    $('gkDictationProgress').style.width = `${(session.index + (question.selected ? 1 : 0)) / session.questions.length * 100}%`;
    $('gkDictationQuestionTitle').textContent = type === 'theory' ? question.theory.prompt : `${LABELS[type]}听记：播放后选择对应的五线谱`;
    $('gkDictationQuestionHelp').textContent = session.submitted
      ? (isCorrect(question) ? '本题回答正确。' : `本题回答错误；绿色为正确答案，红色为你的答案${question.selected ? '' : '（未作答）'}。`)
      : type === 'rhythm' || type === 'melody'
      ? `${question.item.meter || '4/4'} 拍 · 完整谱例 · 可重放` : type === 'theory' ? '乐理选择题；本套试题提交前不显示答案。' : '以五线谱位置判断实际音高，不使用字母加数字作答。';
    $('gkDictationPlay').classList.toggle('hidden', type === 'theory');
    $('gkDictationOptions').innerHTML = type === 'theory' ? question.choices.map((choice, index) => `
      <button class="gk-dictation-option theory${session.submitted && choice === question.theory.answer ? ' correct' : session.submitted && question.selected === choice ? ' wrong' : question.selected === choice ? ' selected' : ''}" type="button" data-choice-index="${index}" ${session.submitted ? 'disabled' : ''}>${escapeHTML(choice)}</button>`).join('') : question.choices.map((choice, index) => `
      <button class="gk-dictation-option${session.submitted && choice.correct ? ' correct' : session.submitted && question.selected === signature(choice.notes) ? ' wrong' : question.selected === signature(choice.notes) ? ' selected' : ''}" type="button" data-choice-index="${index}" aria-label="五线谱选项 ${index + 1}" ${session.submitted ? 'disabled' : ''}>
        ${App.renderEarStaff(choice.notes, ['interval','chord'].includes(type), ['rhythm','melody'].includes(type), question.item.meter || '4/4')}
      </button>`).join('');
    if (!session.submitted) $('gkDictationOptions').querySelectorAll('[data-choice-index]').forEach(button => {
      button.addEventListener('click', () => {
        question.responseTime += Math.max(0, Date.now() - questionShownAt);
        const choice = question.choices[Number(button.dataset.choiceIndex)];
        question.selected = type === 'theory' ? choice : signature(choice.notes);
        renderQuestion();
      });
    });
    $('gkDictationSubmit').classList.toggle('hidden', session.submitted);
    $('gkDictationPrev').disabled = session.index === 0;
    $('gkDictationNext').textContent = session.index === session.questions.length - 1 ? (session.submitted ? '返回成绩 →' : '检查并提交 →') : '下一题 →';
  }

  async function play() {
    if (!session) return;
    const current = session.questions[session.index];
    if (current.type === 'theory') return;
    const item = current.item;
    const button = $('gkDictationPlay');
    button.disabled = true;
    button.textContent = '…';
    try {
      await ensureSamplePiano();
    } catch (error) {
      console.error('听记钢琴采样载入失败。', error);
      button.disabled = false;
      button.textContent = '采样不可用';
      return;
    }
    App.playEarItem?.(item, true, 'piano');
    button.disabled = false;
    button.textContent = '■';
    clearTimeout(play.buttonTimer);
    play.buttonTimer = setTimeout(() => { if (button.isConnected) button.textContent = '▶'; }, 1800);
  }

  function move(delta) {
    if (!session) return;
    const question = session.questions[session.index];
    question.responseTime += Math.max(0, Date.now() - questionShownAt);
    const next = session.index + delta;
    if (next >= session.questions.length) {
      session.submitted ? showResult() : submit(false);
      return;
    }
    session.index = clamp(next, 0, session.questions.length - 1);
    renderQuestion();
  }

  function updateTimer() {
    if (!session || session.submitted) return;
    const remaining = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    $('gkDictationTimer').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    $('gkDictationTimer').classList.toggle('warning', remaining <= 60);
    if (remaining <= 0) submit(true);
  }

  function startTimer() {
    stopTimer();
    updateTimer();
    timerId = setInterval(updateTimer, 250);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = 0;
  }

  function submit(timedOut) {
    if (!session || session.submitted) return;
    const unanswered = session.questions.filter(question => !question.selected).length;
    if (!timedOut && unanswered && !window.confirm(`还有 ${unanswered} 题未作答，确定提交吗？`)) return;
    session.submitted = true;
    session.timedOut = Boolean(timedOut);
    stopTimer();
    App.stopAllAudio?.('dictation-submit');
    const completedAt = Date.now();
    const results = session.questions.map((question, index) => {
      const type = question.type || question.item._type;
      const correctAnswer = type === 'theory' ? question.theory.answer : signature(question.item.notes);
      const correct = question.selected === correctAnswer;
      Store.recordAnswer({
        questionId:question.id, category:type === 'theory' ? 'theory' : 'dictation', knowledgeId:type === 'theory' ? question.theory.knowledgeId : `gaokao.dictation.${type}`,
        difficulty:type === 'theory' ? question.theory.difficulty : 3, userAnswer:question.selected || '未作答', correctAnswer, correct,
        responseTime:question.responseTime || Math.round((completedAt - session.startedAt) / session.questions.length), mode:`dictation-${session.mode}`
      });
      return { type, correct };
    });
    const correct = results.filter(result => result.correct).length;
    session.results = results;
    const score = Math.round(correct / results.length * 100);
    Store.finishSession({ id:session.id, type:'dictation', category:session.mode, questionCount:results.length, correct, accuracy:score, startedAt:session.startedAt, timedOut:session.timedOut });
    $('gkDictationScore').textContent = String(score);
    $('gkDictationResultText').textContent = `${session.timedOut ? '时间结束，系统已自动交卷。' : '你已主动提交本套试题。'} 答对 ${correct} / ${results.length} 题，得分 ${score} 分。`;
    const groups = [...new Set(results.map(result => result.type))];
    $('gkDictationBreakdown').innerHTML = groups.map(type => {
      const items = results.filter(result => result.type === type);
      return `<span>${LABELS[type]} ${items.filter(item => item.correct).length}/${items.length}</span>`;
    }).join('');
    $('gkDictationReview').disabled = correct === results.length;
    $('gkDictationReview').textContent = correct === results.length ? '本套全部正确' : '查看错题';
    showOnly('gkDictationResult');
  }

  function showResult() { showOnly('gkDictationResult'); }

  function reviewMistakes() {
    if (!session?.submitted) return;
    const firstWrong = session.questions.findIndex(question => !isCorrect(question));
    if (firstWrong < 0) return;
    session.index = firstWrong;
    showOnly('gkDictationExam');
    renderQuestion();
  }

  $('gkDictationDashboard')?.addEventListener('click', () => { stopTimer(); window.GaokaoApp?.openDashboard?.(); });
  $('gkDictationSwitchHobby')?.addEventListener('click', () => { stopTimer(); window.HetianEducationUI?.goEducationHome?.(); });
  $('gkDictationIntroBack')?.addEventListener('click', open);
  $('gkDictationStart')?.addEventListener('click', start);
  $('gkDictationPlay')?.addEventListener('click', play);
  $('gkDictationPrev')?.addEventListener('click', () => move(-1));
  $('gkDictationNext')?.addEventListener('click', () => move(1));
  $('gkDictationSubmit')?.addEventListener('click', () => submit(false));
  $('gkDictationRetry')?.addEventListener('click', () => openIntro(activeMode));
  $('gkDictationReview')?.addEventListener('click', reviewMistakes);
  $('gkDictationResultDashboard')?.addEventListener('click', () => window.GaokaoApp?.openDashboard?.());
  window.addEventListener('musictoolbox:pagechange', event => { if (event.detail.id !== 'gaokaoDictation') stopTimer(); });

  const previousBack = App.handleBack;
  App.handleBack = () => {
    if (App.getCurrentPage() === 'gaokaoDictation') {
      if (session && !session.submitted && !window.confirm('退出会结束本次限时训练，确定返回吗？')) return true;
      stopTimer();
      window.GaokaoApp?.openDashboard?.();
      return true;
    }
    return previousBack ? previousBack() : false;
  };

  modeCards();
  window.GaokaoDictation = { open, openIntro, start, submit, getSession:() => session };
})();
