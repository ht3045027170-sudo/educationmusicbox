(() => {
  'use strict';

  const Store = window.GaokaoStore;
  const App = window.HetianApp;
  if (!Store || !App) return;
  const $ = id => document.getElementById(id);
  const CATEGORIES = ['综合训练', '音与音高', '音长与节奏', '乐谱符号', '音程', '和弦', '调式调性'];
  const CATEGORY_TEXT = {
    综合训练: '混合各考纲知识点，按考试节奏完成一套综合卷。',
    音与音高: '音名、唱名、等音、音级与五线谱音高。',
    音长与节奏: '音符、休止符、附点、连音与节奏组合。',
    乐谱符号: '谱号、力度、速度、演奏法与常用记号。',
    音程: '音程度数、音数、性质、转位与协和性。',
    和弦: '三和弦、七和弦、转位、结构与性质。',
    调式调性: '调号、音阶、关系调与调式判断。'
  };
  const FALLBACK_QUESTIONS = [
    { id:'fallback-pitch', category:'音与音高', knowledgeId:'gaokao.theory.pitch.enharmonic', difficulty:1, prompt:'下列哪一组是等音？', options:['C♯与D♭','C与D♭','E与F♯','B与C♯'], answer:'C♯与D♭', explanation:'C♯与D♭在十二平均律中音高相同。' },
    { id:'fallback-rhythm', category:'音长与节奏', knowledgeId:'gaokao.theory.rhythm.dotted', difficulty:1, prompt:'附点四分音符有几拍？', options:['1.5拍','1拍','2拍','0.5拍'], answer:'1.5拍', explanation:'附点增加原时值的一半。' },
    { id:'fallback-sign', category:'乐谱符号', knowledgeId:'gaokao.theory.sign.dynamics', difficulty:1, prompt:'mf表示什么？', options:['中强','很强','中弱','渐强'], answer:'中强', explanation:'mf是mezzo forte的缩写。' },
    { id:'fallback-interval', category:'音程', knowledgeId:'gaokao.theory.interval.major_third', difficulty:1, prompt:'大三度包含几个半音？', options:['4个','3个','5个','6个'], answer:'4个', explanation:'大三度包含四个半音。' },
    { id:'fallback-chord', category:'和弦', knowledgeId:'gaokao.theory.chord.major_triad', difficulty:1, prompt:'大三和弦的叠置结构是？', options:['大三度加小三度','小三度加大三度','两个小三度','两个大三度'], answer:'大三度加小三度', explanation:'大三和弦由大三度与小三度叠置。' },
    { id:'fallback-key', category:'调式调性', knowledgeId:'gaokao.theory.key.G_major', difficulty:1, prompt:'G大调的调号包含哪个升号？', options:['F♯','C♯','G♯','D♯'], answer:'F♯', explanation:'G大调有一个升号F♯。' }
  ];

  let bank = [];
  let bankStatus = 'loading';
  let activeCategory = '综合训练';
  let session = null;
  let questionStartedAt = 0;
  let theoryTimerId = 0;

  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const shuffle = values => {
    const output = [...values];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  };
  const PITCH_TOKEN = /[A-G](?:#|b|♯|♭)?[0-8]/g;
  const PITCH_SEQUENCE = /[A-G](?:#|b|♯|♭)?[0-8](?:\s*[-–—,，、]\s*[A-G](?:#|b|♯|♭)?[0-8])*/g;
  const NOTE_SEQUENCE = /[A-G](?:#|b|♯|♭)?(?:\s*(?:[-–—,，、→]|与|和)\s*[A-G](?:#|b|♯|♭)?)+/g;
  function pitchTokenToMidi(token) {
    const match = String(token).match(/^([A-G])([#b♯♭]?)([0-8])$/);
    if (!match) return null;
    const pitchClass = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[match[1]] + ({ '#':1, '♯':1, b:-1, '♭':-1 }[match[2]] || 0);
    return 12 * (Number(match[3]) + 1) + pitchClass;
  }
  function notationNote(token, octaveOverride = null) {
    const match = String(token).match(/^([A-G])([#b♯♭]?)([0-8])?$/);
    if (!match) return null;
    const octave = octaveOverride ?? Number(match[3]);
    const accidentalOffset = ({ '#':1, '♯':1, b:-1, '♭':-1 }[match[2]] || 0);
    const pitchClass = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[match[1]] + accidentalOffset;
    return { midi:12 * (octave + 1) + pitchClass, dur:1, rest:false, letter:match[1], octave, accidental:accidentalOffset > 0 ? 'sharp' : accidentalOffset < 0 ? 'flat' : 'natural' };
  }
  function notationFromText(text) {
    const explicit = [...String(text || '').matchAll(PITCH_TOKEN)]
      .map(match => notationNote(match[0])).filter(Boolean);
    if (explicit.length) return explicit;
    const groups = [...String(text || '').matchAll(NOTE_SEQUENCE)].map(match => match[0]);
    if (!groups.length) return [];
    const tokens = groups.sort((a, b) => b.length - a.length)[0].match(/[A-G](?:#|b|♯|♭)?/g) || [];
    let previous = -Infinity;
    return tokens.map(token => {
      const match = token.match(/^([A-G])([#b♯♭]?)$/);
      const pitchClass = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[match[1]] + ({ '#':1, '♯':1, b:-1, '♭':-1 }[match[2]] || 0);
      let midi = 60 + pitchClass;
      while (midi < previous) midi += 12;
      previous = midi;
      return notationNote(token, Math.floor(midi / 12) - 1);
    });
  }
  function textWithoutPitchCodes(text, replacement = '下方谱例') {
    return String(text || '').replace(PITCH_SEQUENCE, replacement).replace(NOTE_SEQUENCE, replacement).replace(new RegExp(`${replacement}(?:\\s*[-–—,，、]\\s*${replacement})+`, 'g'), replacement);
  }
  function notationSVG(notes, compact = false) {
    return notes.length && App.renderEarStaff ? App.renderEarStaff(notes, false, compact, '4/4') : '';
  }

  function toast(message) {
    const node = $('gkToast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 2300);
  }

  async function loadBank() {
    const embedded = window.GAOKAO_THEORY_BANK;
    if (Array.isArray(embedded?.questions) && embedded.questions.length) {
      const extra = (window.GAOKAO_QUESTION_BANK?.questions || []).filter(item => item.domain === 'theory');
      bank = [...new Map([...embedded.questions, ...extra, ...(window.GAOKAO_EXTRA_THEORY_BANK?.questions || [])].map(item => [item.id, item])).values()];
      bankStatus = 'offline-ready';
      return;
    }
    try {
      const response = await fetch('gaokao_system/database/theory.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.questions) || !data.questions.length) throw new Error('题库为空');
      bank = data.questions;
      bankStatus = 'ready';
    } catch (error) {
      bank = FALLBACK_QUESTIONS;
      bankStatus = 'fallback';
      console.warn('高考乐理JSON题库未能加载，已启用离线最小题库。', error);
    }
  }

  function enterGaokao() {
    window.HetianSettings?.setMode?.('gaokao');
    if (Store.profileExists()) openDashboard();
    else openProfile(false);
  }

  function openProfile(editing) {
    const profile = Store.getState().profile;
    const form = $('gkProfileForm');
    form.elements.name.value = editing ? profile.name : '';
    form.elements.examDate.value = editing ? profile.examDate || '' : '';
    form.elements.province.value = editing ? profile.province : '广东省';
    form.elements.direction.value = editing ? profile.direction : '音乐教育';
    form.elements.primarySubject.value = editing ? profile.primarySubject : '';
    form.elements.secondarySubject.value = editing ? profile.secondarySubject : '';
    $('gkProfileError').textContent = '';
    App.showPage('gaokaoProfile');
    setTimeout(() => form.elements.name.focus(), 30);
  }

  function dashboardPercent(category) {
    const accuracy = Store.accuracyFor(category);
    return accuracy === null ? { width: 0, label: '—' } : { width: accuracy, label: `${accuracy}%` };
  }

  function setProgress(prefix, value) {
    $(`${prefix}Bar`).style.width = `${value.width}%`;
    $(`${prefix}Percent`).textContent = value.label;
  }

  function daysUntilExam(examDate) {
    if (!examDate) return null;
    const target = new Date(`${examDate}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
  }

  function knowledgeLabel(item) {
    const map = {
      pitch: '音高与等音', rhythm: '音长与节奏', sign: '乐谱符号', interval: '音程', chord: '和弦', key: '调式调性', scale: '音阶'
    };
    const segment = String(item.knowledgeId || '').split('.')[2] || '';
    return map[segment] || item.category || item.knowledgeId;
  }

  function adaptiveQuestions(source, targetCount) {
    const weakIds = new Set(Store.weakKnowledge(6).map(item => item.knowledgeId));
    const weakPool = shuffle(source.filter(question => weakIds.has(question.knowledgeId)));
    const regularPool = shuffle(source.filter(question => !weakIds.has(question.knowledgeId)));
    const weakTarget = Math.min(weakPool.length, Math.ceil(targetCount * 0.6));
    return [...weakPool.slice(0, weakTarget), ...regularPool.slice(0, targetCount - weakTarget)]
      .concat(weakPool.slice(weakTarget, targetCount))
      .slice(0, targetCount);
  }

  function renderDashboard() {
    const state = Store.getState();
    const profile = state.profile;
    $('gkAvatar').textContent = (profile.name || '音').trim().slice(0, 1);
    $('gkStudentName').textContent = profile.name || '艺考生';
    $('gkProfileSummary').textContent = [profile.province, profile.direction, profile.primarySubject && `主项：${profile.primarySubject}`, profile.secondarySubject && `副项：${profile.secondarySubject}`].filter(Boolean).join(' · ');
    const countdown = daysUntilExam(profile.examDate);
    $('gkExamCountdown').textContent = countdown === null
      ? '尚未设置考试时间'
      : countdown < 0 ? `考试日期已过 ${Math.abs(countdown)} 天` : countdown === 0 ? '今天考试' : `距离考试 ${countdown} 天`;
    setProgress('gkTheory', dashboardPercent('theory'));
    setProgress('gkDictation', dashboardPercent('dictation'));
    setProgress('gkSight', dashboardPercent('sight_singing'));
    const today = state.daily[Store.isoDate()] || {};
    const theoryCount = today.theoryQuestions || 0;
    const dictationCount = today.dictationQuestions || 0;
    const sightCount = today.sightSingingCount || 0;
    $('gkTaskList').innerHTML = [
      [theoryCount >= 30, `乐理训练 ${Math.min(theoryCount, 30)}/30题`],
      [dictationCount >= 20, `听写训练 ${Math.min(dictationCount, 20)}/20题`],
      [sightCount >= 1, `视唱训练 ${Math.min(sightCount, 1)}/1条`]
    ].map(([done, label]) => `<div class="gk-task${done ? ' done' : ''}"><i>${done ? '✓' : ''}</i><span>${escapeHTML(label)}</span></div>`).join('');
    const weak = Store.weakKnowledge(4);
    $('gkWeakList').innerHTML = weak.length
      ? `<div class="gk-weak-item"><b>下一组自适应训练</b><br><small>将优先安排下列薄弱知识点，占综合训练约 60%。</small></div>` + weak.map(item => `<div class="gk-weak-item"><b>${escapeHTML(knowledgeLabel(item))}</b><br><small>最近正确率 ${item.recentAccuracy}% · ${item.attempts} 次练习</small></div>`).join('')
      : '<div class="gk-weak-item"><b>等待真实训练数据</b><br><small>完成至少两次同类知识点后生成薄弱分析。</small></div>';
  }

  function openDashboard() {
    renderDashboard();
    App.showPage('gaokaoDashboard');
  }

  function renderCategoryList() {
    $('gkCategoryList').innerHTML = CATEGORIES.map((category, index) => {
      const available = category === '综合训练' ? bank.length : bank.filter(item => item.category === category).length;
      const questionCount = Math.min(10, available);
      return `<button class="gk-dictation-mode" type="button" data-gk-category="${escapeHTML(category)}" ${questionCount ? '' : 'disabled'}><i>${String(index + 1).padStart(2, '0')} / ${category === '综合训练' ? 20 : 15} MIN</i><b>${escapeHTML(category)}${category === '综合训练' ? '模拟卷' : '专项卷'}</b><span>${escapeHTML(CATEGORY_TEXT[category])}</span><small>${questionCount || '暂无'} 题 · 限时 ${category === '综合训练' ? 20 : 15} 分钟 →</small></button>`;
    }).join('');
    $('gkCategoryList').querySelectorAll('[data-gk-category]').forEach(button => {
      button.addEventListener('click', () => showTheoryIntro(button.dataset.gkCategory));
    });
  }

  function showTheoryLanding() {
    clearInterval(theoryTimerId);
    $('gkTheoryLanding').classList.remove('hidden');
    $('gkTheoryIntro').classList.add('hidden');
    $('gkTheoryExam').classList.add('hidden');
    $('gkTheoryResult').classList.add('hidden');
    renderCategoryList();
  }

  function showTheoryIntro(category) {
    activeCategory = category;
    $('gkTheoryLanding').classList.add('hidden');
    $('gkTheoryIntro').classList.remove('hidden');
    $('gkTheoryExam').classList.add('hidden');
    $('gkTheoryResult').classList.add('hidden');
    $('gkTheoryIntroTitle').textContent = `${category}${category === '综合训练' ? '模拟卷' : '专项卷'}`;
    $('gkTheoryIntroText').textContent = CATEGORY_TEXT[category];
    $('gkTheoryMinutes').textContent = category === '综合训练' ? '20' : '15';
    $('gkTheoryCount').textContent = String(Math.min(10, category === '综合训练' ? bank.length : bank.filter(item => item.category === category).length));
  }

  function openTheory() {
    App.showPage('gaokaoTheory');
    if (session && !session.finished) {
      $('gkTheoryLanding').classList.add('hidden');
      $('gkTheoryIntro').classList.add('hidden');
      $('gkTheoryExam').classList.remove('hidden');
      $('gkQuestionCard').classList.remove('hidden');
      $('gkTheoryResult').classList.add('hidden');
      renderQuestion();
      startTheoryTimer();
    } else showTheoryLanding();
  }

  function startTheorySession(category = '综合训练') {
    activeCategory = category;
    renderCategoryList();
    const source = category === '综合训练' ? bank : bank.filter(item => item.category === category);
    if (!source.length) {
      toast('这个分类暂时没有可用题目。');
      return;
    }
    const targetCount = Math.min(10, source.length);
    const selected = category === '综合训练'
      ? adaptiveQuestions(source, targetCount)
      : shuffle(source).slice(0, targetCount);
    session = {
      id: `gk-session-${Date.now()}`,
      category,
      questions: shuffle(selected),
      answers: Array(targetCount).fill(null),
      index: 0,
      startedAt: Date.now(),
      deadline: Date.now() + (category === '综合训练' ? 20 : 15) * 60000,
      finished: false
    };
    $('gkTheoryLanding').classList.add('hidden');
    $('gkTheoryIntro').classList.add('hidden');
    $('gkTheoryExam').classList.remove('hidden');
    $('gkQuestionCard').classList.remove('hidden');
    $('gkTheoryResult').classList.add('hidden');
    renderQuestion();
    startTheoryTimer();
  }

  function updateTheoryTimer() {
    if (!session || session.finished) return;
    const remaining = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
    $('gkTheoryTimer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    $('gkTheoryTimer').classList.toggle('warning', remaining <= 60);
    if (!remaining) finishTheorySession(true);
  }

  function startTheoryTimer() {
    clearInterval(theoryTimerId);
    updateTheoryTimer();
    theoryTimerId = setInterval(updateTheoryTimer, 250);
  }

  function renderQuestion() {
    if (!session) return;
    const question = session.questions[session.index];
    const stored = session.answers[session.index];
    questionStartedAt = Date.now();
    $('gkQuestionCategory').textContent = `${question.category} · 难度 ${question.difficulty}`;
    $('gkQuestionCounter').textContent = `${session.index + 1} / ${session.questions.length}`;
    $('gkQuestionProgress').style.width = `${(session.index + (stored ? 1 : 0)) / session.questions.length * 100}%`;
    const promptNotes = notationFromText(question.prompt);
    $('gkTheoryTitle').textContent = promptNotes.length ? textWithoutPitchCodes(question.prompt) : question.prompt;
    const notation = $('gkTheoryNotation');
    notation.classList.toggle('hidden', !promptNotes.length);
    notation.innerHTML = notationSVG(promptNotes);
    const orderedOptions = stored?.optionOrder || shuffle(question.options);
    $('gkOptions').innerHTML = orderedOptions.map(option => {
      const classes = stored ? option === question.answer ? ' correct' : (!stored.correct && option === stored.userAnswer ? ' wrong' : '') : '';
      const optionNotes = notationFromText(option);
      const optionText = optionNotes.length ? textWithoutPitchCodes(option, '') : option;
      return `<button class="gk-option${optionNotes.length ? ' notation' : ''}${classes}" type="button" data-gk-answer="${escapeHTML(option)}" ${stored ? 'disabled' : ''} aria-label="${optionNotes.length ? '五线谱答案选项' : escapeHTML(option)}">${optionText.trim() ? `<span>${escapeHTML(optionText)}</span>` : ''}${notationSVG(optionNotes, true)}</button>`;
    }).join('');
    if (!stored) {
      $('gkOptions').querySelectorAll('[data-gk-answer]').forEach(button => button.addEventListener('click', () => answerQuestion(button.dataset.gkAnswer, orderedOptions)));
      $('gkExplanation').textContent = '选择答案后显示解析。题目不会自动跳走。';
    } else {
      const answerHasNotation = notationFromText(question.answer).length > 0;
      const answerLabel = answerHasNotation ? '正确答案见绿色五线谱' : `正确答案：${escapeHTML(question.answer)}`;
      $('gkExplanation').innerHTML = `<b>${stored.correct ? '回答正确' : answerLabel}</b><br>${escapeHTML(textWithoutPitchCodes(question.explanation, '谱例所示音'))}`;
    }
    $('gkPrevQuestion').disabled = session.index === 0;
    $('gkNextQuestion').disabled = !stored;
    $('gkTheorySubmit').classList.toggle('hidden', Boolean(session.reviewing));
    $('gkTheoryReturnResult').classList.toggle('hidden', !session.reviewing);
    $('gkNextQuestion').textContent = session.index === session.questions.length - 1 ? (session.reviewing ? '返回成绩 →' : '完成训练 →') : '下一题 →';
  }

  function answerQuestion(answer, optionOrder) {
    if (!session || session.answers[session.index]) return;
    const question = session.questions[session.index];
    const correct = answer === question.answer;
    Store.recordAnswer({
      questionId: question.id,
      category: 'theory',
      knowledgeId: question.knowledgeId,
      difficulty: question.difficulty,
      userAnswer: answer,
      correctAnswer: question.answer,
      correct,
      responseTime: Date.now() - questionStartedAt,
      mode: session.category === '综合训练' ? 'theory-mixed' : 'theory-category'
    });
    session.answers[session.index] = { userAnswer: answer, correct, optionOrder };
    renderQuestion();
  }

  function finishTheorySession(timedOut = false) {
    if (!session || session.finished) return;
    if (!timedOut) {
      const unanswered = session.answers.filter(answer => !answer).length;
      if (unanswered && !window.confirm(`还有 ${unanswered} 题未作答，确定提交吗？`)) return;
    }
    session.finished = true;
    clearInterval(theoryTimerId);
    session.answers.forEach((answer, index) => {
      if (answer) return;
      const question = session.questions[index];
      session.answers[index] = { userAnswer:'未作答', correct:false, optionOrder:shuffle(question.options) };
      Store.recordAnswer({ questionId:question.id, category:'theory', knowledgeId:question.knowledgeId, difficulty:question.difficulty, userAnswer:'未作答', correctAnswer:question.answer, correct:false, responseTime:0, mode:session.category === '综合训练' ? 'theory-mixed' : 'theory-category' });
    });
    const answered = session.answers.filter(Boolean);
    const correct = answered.filter(item => item.correct).length;
    const accuracy = Math.round(correct / session.questions.length * 100);
    Store.finishSession({ id: session.id, type: 'theory', category: session.category, questionCount: session.questions.length, correct, accuracy, startedAt: session.startedAt, timedOut });
    $('gkTheoryExam').classList.add('hidden');
    $('gkQuestionCard').classList.add('hidden');
    $('gkTheoryResult').classList.remove('hidden');
    $('gkResultScore').textContent = `${accuracy}%`;
    $('gkResultText').textContent = `${timedOut ? '时间结束，系统已自动交卷。' : '本套试题已提交。'} 答对 ${correct} / ${session.questions.length} 题。错题和知识点正确率已写入独立高考数据库。`;
    $('gkReviewTheory').disabled = correct === session.questions.length;
    $('gkReviewTheory').textContent = correct === session.questions.length ? '本套全部正确' : '查看错题';
  }

  function showTheoryResult() {
    session.reviewing = false;
    $('gkTheoryExam').classList.add('hidden');
    $('gkQuestionCard').classList.add('hidden');
    $('gkTheoryResult').classList.remove('hidden');
  }

  function reviewTheoryMistakes() {
    if (!session?.finished) return;
    const firstWrong = session.answers.findIndex(answer => !answer.correct);
    if (firstWrong < 0) return;
    session.reviewing = true;
    session.index = firstWrong;
    $('gkTheoryResult').classList.add('hidden');
    $('gkTheoryExam').classList.remove('hidden');
    $('gkQuestionCard').classList.remove('hidden');
    renderQuestion();
  }

  function showBlueprint() { window.GaokaoDictation?.openIntro?.('guangdong_mock'); }

  $('portalToolbox')?.addEventListener('click', () => App.showPage('menu'));
  $('gkProfileForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name.trim() || !data.examDate || !data.province || !data.direction || !data.primarySubject.trim()) {
      $('gkProfileError').textContent = '请填写姓名、高考时间、考试省份、未来方向和主项。';
      return;
    }
    Store.saveProfile({
      name: data.name.trim(), examDate: data.examDate, province: data.province,
      direction: data.direction, primarySubject: data.primarySubject.trim(), secondarySubject: data.secondarySubject.trim()
    });
    openDashboard();
  });
  $('gkEditProfile')?.addEventListener('click', () => openProfile(true));
  const switchToHobby = () => window.HetianEducationUI?.goEducationHome?.();
  $('gkProfileSwitchHobby')?.addEventListener('click', switchToHobby);
  $('gkSwitchHobby')?.addEventListener('click', switchToHobby);
  $('gkTheorySwitchHobby')?.addEventListener('click', switchToHobby);
  document.querySelectorAll('#gkOpenSettings').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.HetianEducationUI?.openSettings) window.HetianEducationUI.openSettings();
      else App.showPage('eduSettings');
    });
  });
  $('gkStartTraining')?.addEventListener('click', openTheory);
  $('gkOpenTheory')?.addEventListener('click', openTheory);
  $('gkOpenDictation')?.addEventListener('click', () => window.GaokaoDictation?.open?.());
  $('gkOpenSight')?.addEventListener('click', () => App.showPage('sightSinging'));
  $('gkOpenTools')?.addEventListener('click', () => App.showPage('gkTools'));
  $('gkOpenTeacherCenter')?.addEventListener('click', () => {
    if (window.HetianAuth?.getUser?.()?.role !== 'teacher') return;
    const frame = $('gkTeacherFrame');
    if (frame && !frame.src) frame.src = 'teacher.html?embedded=1';
    App.showPage('gkTeacherCenter');
  });
  $('gkOpenStudentClass')?.addEventListener('click', () => window.MusicHomework?.open?.('gaokao'));
  $('gkTeacherBack')?.addEventListener('click', openDashboard);
  $('gkToolsBack')?.addEventListener('click', openDashboard);
  document.querySelectorAll('#gkTools .gk-tool-card').forEach(card => {
    card.addEventListener('click', () => App.showPage(card.dataset.tool));
  });
  $('gkMockExam')?.addEventListener('click', showBlueprint);
  $('gkTheoryDashboard')?.addEventListener('click', openDashboard);
  $('gkTheoryIntroBack')?.addEventListener('click', showTheoryLanding);
  $('gkTheoryStart')?.addEventListener('click', () => startTheorySession(activeCategory));
  $('gkPrevQuestion')?.addEventListener('click', () => { if (session && session.index > 0) { session.index -= 1; renderQuestion(); } });
  $('gkNextQuestion')?.addEventListener('click', () => {
    if (!session?.answers?.[session.index]) return;
    if (session.index >= session.questions.length - 1) session.reviewing ? showTheoryResult() : finishTheorySession();
    else { session.index += 1; renderQuestion(); }
  });
  $('gkTheorySubmit')?.addEventListener('click', () => finishTheorySession(false));
  $('gkTheoryReturnResult')?.addEventListener('click', showTheoryResult);
  $('gkReviewTheory')?.addEventListener('click', reviewTheoryMistakes);
  $('gkRetryTheory')?.addEventListener('click', () => startTheorySession(activeCategory));
  $('gkResultDashboard')?.addEventListener('click', openDashboard);

  const previousBack = App.handleBack;
  App.handleBack = () => {
    const current = App.getCurrentPage();
    if (current === 'eduSettings') { openDashboard(); return true; }
    if (current === 'gaokaoTheory' || current === 'gaokaoProfile') { openDashboard(); return true; }
    if (current === 'gaokaoDashboard') return false;
    return previousBack ? previousBack() : false;
  };

  window.addEventListener('musictoolbox:pagechange', event => {
    if (event.detail.id === 'gaokaoDashboard') renderDashboard();
    if (event.detail.id !== 'gaokaoTheory') clearInterval(theoryTimerId);
  });

  loadBank().then(() => {
    if (bankStatus === 'fallback') toast('当前为直接打开HTML模式，已启用内置最小题库。');
  });
  renderCategoryList();
  window.GaokaoApp = { enterGaokao, openDashboard, openTheory, startTheorySession, getBankStatus: () => bankStatus };
})();
