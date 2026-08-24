(() => {
  'use strict';

  const Education = window.HetianEducation;
  const App = window.HetianApp;
  const bank = window.GUITAR_THEORY_DATABASE;
  if (!Education || !App || !bank) return;
  const $ = id => document.getElementById(id);
  let view = 'home';
  let lesson = null;
  let session = null;

  const show = name => {
    view = name;
    ['Home', 'Map', 'Lesson', 'Question', 'Result'].forEach(item => {
      $(`guitar${item}View`)?.classList.toggle('hidden', item.toLowerCase() !== name);
    });
  };
  const shuffle = values => [...values].sort(() => Math.random() - .5);
  const chapterQuestions = chapter => bank.questions.filter(question => question.chapter === chapter);
  const progressFor = id => Education.getState().theoryProgress?.[id] || {};
  const percent = value => `${Math.round((Number(value) || 0) * 100)}%`;

  function groupProgress(chapters) {
    const values = chapters.map(chapter => Number(progressFor(`guitar-chapter-${chapter}`).bestAccuracy) || 0);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function renderProgress() {
    const groups = [
      { id: 'guitarBasicProgress', label: '基础乐理', chapters: [1, 2, 3, 4] },
      { id: 'guitarRhythmProgress', label: '节奏', chapters: [5, 6] },
      { id: 'guitarChordProgress', label: '和弦', chapters: [7] },
      { id: null, label: '音程', chapters: [8] }
    ].map(group => ({ ...group, score: groupProgress(group.chapters) }));
    groups.forEach(group => { if (group.id) $(group.id).textContent = percent(group.score); });
    const weakest = groups.sort((a, b) => a.score - b.score)[0];
    $('guitarAdvice').textContent = weakest.score ? `加强${weakest.label}` : '从六线谱开始';
  }

  function open() {
    renderProgress();
    show('home');
    App.showPage('guitarAcademy');
  }

  function openMap() {
    $('guitarChapterGrid').innerHTML = bank.lessons.map(item => {
      const progress = progressFor(item.id);
      const stars = progress.stars ? `${'★'.repeat(progress.stars)}${'☆'.repeat(3 - progress.stars)}` : '未练习';
      return `<button class="guitar-chapter" type="button" data-guitar-lesson="${item.id}"><small>CHAPTER ${String(item.chapter).padStart(2, '0')} · ${item.group}</small><b>${item.title}</b><span>${item.subtitle}</span><em>${stars}</em></button>`;
    }).join('');
    show('map');
    App.showPage('guitarAcademy');
  }

  function showLesson(id) {
    lesson = bank.lessons.find(item => item.id === id);
    if (!lesson) return;
    $('guitarLessonKicker').textContent = `CHAPTER ${String(lesson.chapter).padStart(2, '0')} · ${lesson.group}`;
    $('guitarLessonTitle').textContent = lesson.title;
    $('guitarLessonIntro').textContent = lesson.intro;
    $('guitarLessonBullets').innerHTML = lesson.bullets.map(item => `<li>${item}</li>`).join('');
    $('guitarLessonApplications').innerHTML = (lesson.applications || []).map(item => `<div class="guitar-application"><b>${item.name} · ${item.formula}</b><span>组成音：${item.tones}</span><span>常用按法：${item.fingering}</span></div>`).join('');
    $('guitarOpenChordFinder').classList.toggle('hidden', lesson.chapter !== 7);
    show('lesson');
  }

  function startLesson() {
    if (!lesson) return;
    const questions = shuffle(chapterQuestions(lesson.chapter)).slice(0, 10).map(question => ({ ...question, options: shuffle(question.options) }));
    session = { questions, answers: Array(questions.length).fill(null), index: 0, startedAt: Date.now() };
    renderQuestion();
    show('question');
  }

  function renderQuestion() {
    const question = session?.questions[session.index];
    if (!question) return;
    const answer = session.answers[session.index];
    $('guitarQuestionCounter').textContent = `${session.index + 1} / ${session.questions.length}`;
    $('guitarQuestionProgress').style.width = `${(session.index + 1) / session.questions.length * 100}%`;
    $('guitarQuestionType').textContent = `${question.type} · ${question.difficulty}`;
    $('guitarQuestionText').textContent = question.question;
    $('guitarQuestionOptions').innerHTML = question.options.map(option => {
      const state = !answer ? '' : option === question.answer ? ' correct' : option === answer.userAnswer ? ' wrong' : '';
      return `<button class="guitar-option${state}" type="button" data-guitar-answer="${option.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" ${answer ? 'disabled' : ''}>${option}</button>`;
    }).join('');
    $('guitarQuestionExplanation').textContent = answer ? `${answer.correct ? '回答正确。' : `正确答案：${question.answer}。`} ${question.analysis}` : '';
    $('guitarQuestionExplanation').classList.toggle('hidden', !answer);
    $('guitarPrevQuestion').disabled = session.index === 0;
    $('guitarNextQuestion').disabled = !answer;
    $('guitarNextQuestion').textContent = session.index === session.questions.length - 1 ? '查看结果' : '下一题';
  }

  function answerQuestion(userAnswer) {
    if (!session || session.answers[session.index]) return;
    const question = session.questions[session.index];
    const correct = userAnswer === question.answer;
    session.answers[session.index] = { userAnswer, correct };
    Education.recordTheoryAnswer({
      question,
      questionType: 'guitar_theory',
      category: 'guitar_theory',
      knowledgeId: question.knowledgeId,
      difficulty: question.difficulty === '初级' ? 1 : question.difficulty === '中级' ? 2 : 3,
      userAnswer,
      correct,
      correctAnswer: question.answer,
      source: 'guitar-theory',
      levelId: lesson.id
    });
    renderQuestion();
  }

  function finish() {
    const correct = session.answers.filter(answer => answer?.correct).length;
    const accuracy = correct / session.questions.length;
    const stars = accuracy >= .9 ? 3 : accuracy >= .8 ? 2 : accuracy >= .6 ? 1 : 0;
    Education.updateState(state => {
      const previous = state.theoryProgress[lesson.id] || {};
      state.theoryProgress[lesson.id] = {
        ...previous,
        attempts: (previous.attempts || 0) + 1,
        bestAccuracy: Math.max(previous.bestAccuracy || 0, accuracy),
        stars: Math.max(previous.stars || 0, stars),
        lastCompletedAt: Date.now()
      };
      return state;
    });
    $('guitarResultTitle').textContent = `${lesson.title} · 练习完成`;
    $('guitarResultAccuracy').textContent = percent(accuracy);
    $('guitarResultMessage').textContent = stars ? `答对 ${correct} / ${session.questions.length}，获得 ${stars} 星。` : `答对 ${correct} / ${session.questions.length}，建议先复习本章知识，再次挑战。`;
    renderProgress();
    show('result');
  }

  function exportNotes() {
    const lines = ['# 吉他入门乐理', '', '> 海棠音乐 · 离线导出', ''];
    bank.lessons.forEach(item => {
      lines.push(`## ${item.chapter}. ${item.title}`, '', item.intro, '', ...item.bullets.map(text => `- ${text}`), '');
      (item.applications || []).forEach(chord => lines.push(`### ${chord.name}`, `- 公式：${chord.formula}`, `- 组成音：${chord.tones}`, `- 吉他按法：${chord.fingering}`, ''));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '吉他入门乐理.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function auditQuestionBank() {
    const issues = [];
    if (bank.lessons.length !== 8) issues.push('章节数量不是8');
    bank.lessons.forEach(item => { if (!chapterQuestions(item.chapter).length) issues.push(`${item.title}没有题目`); });
    bank.questions.forEach(question => {
      if (!question.id || !question.knowledgeId || !question.analysis) issues.push(`${question.id || '未知题目'}字段不完整`);
      if (!question.options.includes(question.answer)) issues.push(`${question.id}答案不在选项中`);
    });
    return { ok: issues.length === 0, questions: bank.questions.length, issues };
  }

  $('guitarBackHome')?.addEventListener('click', () => window.HetianEducationUI?.goEducationHome?.());
  $('guitarOpenTheory')?.addEventListener('click', openMap);
  $('guitarRouteTheory')?.addEventListener('click', openMap);
  $('guitarMapHome')?.addEventListener('click', open);
  $('guitarChapterGrid')?.addEventListener('click', event => { const button = event.target.closest('[data-guitar-lesson]'); if (button) showLesson(button.dataset.guitarLesson); });
  $('guitarLessonBack')?.addEventListener('click', openMap);
  $('guitarStartQuestions')?.addEventListener('click', startLesson);
  $('guitarOpenChordFinder')?.addEventListener('click', () => App.showPage('chordFinder'));
  $('guitarExitQuestions')?.addEventListener('click', () => showLesson(lesson.id));
  $('guitarQuestionOptions')?.addEventListener('click', event => { const option = event.target.closest('[data-guitar-answer]'); if (option) answerQuestion(option.dataset.guitarAnswer); });
  $('guitarPrevQuestion')?.addEventListener('click', () => { if (session.index > 0) { session.index -= 1; renderQuestion(); } });
  $('guitarNextQuestion')?.addEventListener('click', () => { if (!session.answers[session.index]) return; if (session.index === session.questions.length - 1) finish(); else { session.index += 1; renderQuestion(); } });
  $('guitarResultMap')?.addEventListener('click', openMap);
  $('guitarResultRetry')?.addEventListener('click', startLesson);
  $('guitarExportNotes')?.addEventListener('click', exportNotes);

  const previousBack = App.handleBack;
  App.handleBack = () => {
    if (App.getCurrentPage() !== 'guitarAcademy') return previousBack?.() ?? false;
    if (view === 'question') { showLesson(lesson.id); return true; }
    if (view === 'lesson' || view === 'result') { openMap(); return true; }
    if (view === 'map') { open(); return true; }
    window.HetianEducationUI?.goEducationHome?.();
    return true;
  };

  window.GuitarAcademy = { open, openMap, auditQuestionBank };
  const audit = auditQuestionBank();
  if (!audit.ok) console.error('吉他题库检查失败', audit.issues);
})();
