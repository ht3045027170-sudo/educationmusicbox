(() => {
  'use strict';

  const Education = window.HetianEducation;
  const App = window.HetianApp;
  if (!Education || !App) return;
  const $ = id => document.getElementById(id);

  const LEVELS = [
    { id:'theory-1-1', chapter:1, order:1, title:'五线谱认识', subtitle:'认识五条线与四个间', type:'staff_note_identification', knowledgeId:'theory.staff.lines_spaces', difficulty:1, lesson:'五线谱由五条平行线和四个间组成。音符在线上或间里的位置，决定它的音高。', count:8 },
    { id:'theory-1-2', chapter:1, order:2, title:'谱号识别', subtitle:'高音、低音与中音谱号', type:'clef_identification', knowledgeId:'theory.staff.clef', difficulty:1, lesson:'谱号先确定音高参照点。高音谱号以 G 为基准，低音谱号以 F 为基准，中音谱号以 C 为基准。', count:8 },
    { id:'theory-1-3', chapter:1, order:3, title:'音符名称', subtitle:'从谱面位置判断音名', type:'staff_note_identification', knowledgeId:'theory.staff.note_names', difficulty:2, lesson:'先确认谱号，再按线间顺序读出音名。本关会加入更接近考试的相邻音选择。', count:10 },
    { id:'theory-1-4', chapter:1, order:4, title:'音符时值', subtitle:'全音符到十六分音符', type:'note_duration', knowledgeId:'theory.rhythm.duration', difficulty:1, lesson:'时值决定声音持续多久。全音符等于两个二分音符，四分音符等于两个八分音符。', count:8 },
    { id:'theory-1-review', chapter:1, order:5, title:'章节总复习', subtitle:'30 题混合 · 考试型挑战', type:'chapter_review', knowledgeId:'theory.chapter1.review', difficulty:5, lesson:'本关混合五线谱音高、谱号和时值。30 题连续作答，适合完成章节后检验掌握情况。', count:30, timeLimit:true },
    { id:'theory-2-1', chapter:2, order:5, title:'基础拍号', subtitle:'看懂每小节的拍数', type:'time_signature', knowledgeId:'theory.rhythm.time_signature', difficulty:1, lesson:'拍号上方表示每小节有几拍，下方表示以哪一种音符为一拍。', count:8 },
    { id:'theory-2-2', chapter:2, order:6, title:'时值组合', subtitle:'计算一小节能放下多少拍', type:'note_duration', knowledgeId:'theory.rhythm.duration_combinations', difficulty:2, lesson:'把每个音符换算成拍数，再和拍号的总拍数比较。附点会增加原时值的一半。', count:10 },
    { id:'theory-2-3', chapter:2, order:7, title:'节奏听辨', subtitle:'听到节奏后选择对应谱例', type:'rhythm_listening', knowledgeId:'theory.rhythm.listening', difficulty:2, lesson:'先听稳定拍点，再辨认每个音符的进入位置。需要重听时可以使用播放按钮。', count:8 }
    ,{ id:'theory-2-review', chapter:2, order:8, title:'章节总复习', subtitle:'30 题混合 · 考试型挑战', type:'chapter_review', knowledgeId:'theory.chapter2.review', difficulty:5, lesson:'本关混合拍号、时值组合和节奏听辨。30 题连续作答，题目不会只重复同一知识点。', count:30, timeLimit:true }
  ];
  const CHAPTERS = [
    [1, '第一章 · 音符世界', '从读谱参照点开始，建立音符和时值基础。'],
    [2, '第二章 · 节奏王国', '把拍号、组合时值和听到的节奏连起来。'],
    [3, '第三章 · 调性森林', '调号与调性识别', false],
    [4, '第四章 · 音阶大陆', '音阶组成与级数', false],
    [5, '第五章 · 和弦城堡', '和弦组成与性质', false],
    [6, '第六章 · 音乐术语', '速度、力度与表情术语', false],
    [7, '第七章 · 高考综合挑战', '综合运用与考试模拟', false]
  ];

  let session = null;
  let currentQuestion = null;
  let locked = false;

  const shuffle = values => {
    const output = [...values];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  };
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  // 高音谱表的坐标按真实线间位置计算：最下一线 E4 为 y=72，每个级进相差 6px。
  // 这张表故意只用 C4-G5，避免在初级关卡中出现没有讲过的多条加线。
  const TREBLE_NOTES = [
    { name:'C4', solfege:'do（中央C）', y:84, ledger:[84], place:'下加一线' },
    { name:'D4', solfege:'re', y:78, ledger:[], place:'第一线下方' },
    { name:'E4', solfege:'mi', y:72, ledger:[], place:'第一线' },
    { name:'F4', solfege:'fa', y:66, ledger:[], place:'第一间' },
    { name:'G4', solfege:'sol', y:60, ledger:[], place:'第二线' },
    { name:'A4', solfege:'la', y:54, ledger:[], place:'第二间' },
    { name:'B4', solfege:'si', y:48, ledger:[], place:'第三线' },
    { name:'C5', solfege:'do', y:42, ledger:[], place:'第三间' },
    { name:'D5', solfege:'re', y:36, ledger:[], place:'第四线' },
    { name:'E5', solfege:'mi', y:30, ledger:[], place:'第四间' },
    { name:'F5', solfege:'fa', y:24, ledger:[], place:'第五线' }
  ];

  function staffLines() {
    return `<g stroke="#9aaca0" stroke-width="2">${[24,36,48,60,72].map(y => `<line x1="74" y1="${y}" x2="470" y2="${y}"/>`).join('')}</g>`;
  }

  function svgStaffNote(note) {
    const x = 270;
    const stemUp = note.y >= 48;
    return `<svg class="theory-staff" viewBox="0 0 540 126" role="img" aria-label="高音谱表 ${note.name}">${staffLines()}<text x="92" y="80" class="theory-clef">𝄞</text>${note.ledger.map(y => `<line x1="${x - 15}" y1="${y}" x2="${x + 15}" y2="${y}" stroke="#24372d" stroke-width="2.4"/>`).join('')}<ellipse class="theory-note" cx="${x}" cy="${note.y}" rx="9" ry="6.5" transform="rotate(-18 ${x} ${note.y})"/>${stemUp ? `<line class="theory-note" x1="${x + 8}" y1="${note.y - 2}" x2="${x + 8}" y2="${note.y - 36}" stroke-width="2.8"/>` : `<line class="theory-note" x1="${x - 8}" y1="${note.y + 2}" x2="${x - 8}" y2="${note.y + 36}" stroke-width="2.8"/>`}</svg>`;
  }

  function clefVisual(clef) {
    const glyphs = { treble:'𝄞', bass:'𝄢', alto:'𝄡' };
    return `<svg class="theory-staff" viewBox="0 0 540 126" role="img" aria-label="谱号识别">${staffLines()}<text x="245" y="83" class="theory-clef">${glyphs[clef]}</text></svg>`;
  }

  function durationVisual(kind, dotted = false) {
    const filled = !['whole','half'].includes(kind);
    const stem = kind !== 'whole';
    const flags = kind === 'eighth' ? 1 : kind === 'sixteenth' ? 2 : 0;
    return `<svg class="theory-duration" viewBox="0 0 220 120" role="img" aria-label="音符时值"><ellipse cx="88" cy="72" rx="15" ry="10" fill="${filled ? '#24372d' : '#fffdf7'}" stroke="#24372d" stroke-width="3" transform="rotate(-18 88 72)"/>${stem ? '<line x1="102" y1="70" x2="102" y2="24" stroke="#24372d" stroke-width="4"/>' : ''}${flags >= 1 ? '<path d="M102 25 Q128 32 118 49" fill="none" stroke="#24372d" stroke-width="4"/>' : ''}${flags >= 2 ? '<path d="M102 37 Q128 44 118 61" fill="none" stroke="#24372d" stroke-width="4"/>' : ''}${dotted ? '<circle cx="128" cy="72" r="4" fill="#24372d"/>' : ''}</svg>`;
  }

  function rhythmVisual(parts) {
    return `<div class="theory-rhythm" aria-label="节奏型">${parts.map(part => part === 'quarter' ? '♩' : part === 'eighthPair' ? '♪♪' : part === 'half' ? '𝅗𝅥' : part === 'dottedQuarter' ? '♩.' : part).join(' &nbsp; ')}</div>`;
  }

  function buildQuestion(level, index) {
    const id = `${level.id}-${index + 1}`;
    if (level.type === 'chapter_review') {
      const sourceIds = level.chapter === 1
        ? ['theory-1-1', 'theory-1-2', 'theory-1-3', 'theory-1-4']
        : ['theory-2-1', 'theory-2-2', 'theory-2-3'];
      const source = LEVELS.find(item => item.id === sourceIds[index % sourceIds.length]);
      const question = buildQuestion(source, index + Math.floor(index / sourceIds.length));
      return { ...question, id, difficulty:5, source:'chapter_review', reviewChapter:level.chapter };
    }
    if (level.type === 'clef_identification') {
      const clefs = [
        { key:'treble', answer:'高音谱号', explanation:'高音谱号又叫 G 谱号，它围绕第二线，第二线表示 G4。' },
        { key:'bass', answer:'低音谱号', explanation:'低音谱号又叫 F 谱号，两个圆点夹住第四线，第四线表示 F3。' },
        { key:'alto', answer:'中音谱号', explanation:'中音谱号又叫 C 谱号，中间的尖角所指的第三线表示 C4。' }
      ];
      const item = clefs[index % clefs.length];
      return { id, category:'theory', questionType:'clef_identification', knowledgeId:level.knowledgeId, difficulty:level.difficulty, title:'这个谱号是什么？', visual:clefVisual(item.key), answer:item.answer, options:shuffle(clefs.map(value => value.answer)), explanation:item.explanation };
    }
    if (level.id === 'theory-1-4') {
      const values = [
        { kind:'whole', answer:'4拍', label:'全音符', explanation:'在 4/4 拍中，全音符占满一小节，共 4 拍。' },
        { kind:'half', answer:'2拍', label:'二分音符', explanation:'二分音符等于两个四分音符，在 4/4 拍中占 2 拍。' },
        { kind:'quarter', answer:'1拍', label:'四分音符', explanation:'四分音符是最常用的基本拍单位，在 4/4 拍中占 1 拍。' },
        { kind:'eighth', answer:'1/2拍', label:'八分音符', explanation:'两个八分音符合起来等于一个四分音符，所以每个占 1/2 拍。' },
        { kind:'sixteenth', answer:'1/4拍', label:'十六分音符', explanation:'四个十六分音符合起来等于一个四分音符，所以每个占 1/4 拍。' },
        { kind:'quarter', dotted:true, answer:'1又1/2拍', label:'附点四分音符', explanation:'附点增加原音符时值的一半：四分音符 1 拍，加上半拍，合计 1 又 1/2 拍。' }
      ];
      const item = values[index % values.length];
      return { id, category:'theory', questionType:'note_duration', knowledgeId:level.knowledgeId, difficulty:level.difficulty, title:'在 4/4 拍中，图中的音符占几拍？', visual:durationVisual(item.kind, item.dotted), answer:item.answer, options:shuffle(['4拍','2拍','1拍','1/2拍','1/4拍','1又1/2拍']), explanation:item.explanation };
    }
    if (level.id === 'theory-2-2') {
      const values = [
        { parts:['quarter','eighthPair'], answer:'2拍', explanation:'四分音符占 1 拍，两个八分音符合起来占 1 拍，共 2 拍。' },
        { parts:['half','quarter','quarter'], answer:'4拍', explanation:'二分音符占 2 拍，两个四分音符各占 1 拍，共 4 拍。' },
        { parts:['eighthPair','eighthPair','quarter'], answer:'3拍', explanation:'每一对八分音符占 1 拍，两对是 2 拍，再加一个四分音符，共 3 拍。' },
        { parts:['dottedQuarter','eighthPair'], answer:'2又1/2拍', explanation:'附点四分音符占 1 又 1/2 拍，一对八分音符占 1 拍，共 2 又 1/2 拍。' }
      ];
      const item = values[index % values.length];
      return { id, category:'theory', questionType:'note_duration_combination', knowledgeId:level.knowledgeId, difficulty:level.difficulty, title:'这个节奏组合一共占多少拍？', visual:rhythmVisual(item.parts), answer:item.answer, options:shuffle(['2拍','2又1/2拍','3拍','4拍']), explanation:item.explanation };
    }
    if (level.type === 'time_signature') {
      const values = [
        { meter:'2/4', answer:'每小节有 2 个四分音符拍', explanation:'2/4 拍：上方 2 表示每小节两拍，下方 4 表示以四分音符为一拍。' },
        { meter:'3/4', answer:'每小节有 3 个四分音符拍', explanation:'3/4 拍：每小节三拍，以四分音符为一拍。' },
        { meter:'4/4', answer:'每小节有 4 个四分音符拍', explanation:'4/4 拍：每小节四拍，以四分音符为一拍。' },
        { meter:'6/8', answer:'每小节有 6 个八分音符', explanation:'6/8 拍：每小节包含六个八分音符，常按两大拍感受。' }
      ];
      const item = values[index % values.length];
      return { id, category:'theory', questionType:'time_signature', knowledgeId:level.knowledgeId, difficulty:level.difficulty, title:'这个拍号表示什么？', visual:`<div class="theory-rhythm theory-meter"><sup>${item.meter.split('/')[0]}</sup><br><sub>${item.meter.split('/')[1]}</sub></div>`, answer:item.answer, options:shuffle(values.map(value => value.answer)), explanation:item.explanation };
    }
    if (level.type === 'rhythm_listening') {
      const patterns = [
        { label:'♩ ♩ ♪♪ ♩', notes:[{midi:60,dur:1},{midi:60,dur:1},{midi:60,dur:.5},{midi:60,dur:.5},{midi:60,dur:1}] },
        { label:'♪♪ ♩ ♩', notes:[{midi:60,dur:.5},{midi:60,dur:.5},{midi:60,dur:1},{midi:60,dur:1}] },
        { label:'♩. ♪ ♩', notes:[{midi:60,dur:1.5},{midi:60,dur:.5},{midi:60,dur:1}] },
        { label:'♩ ♪♪ ♪♪', notes:[{midi:60,dur:1},{midi:60,dur:.5},{midi:60,dur:.5},{midi:60,dur:.5},{midi:60,dur:.5}] }
      ];
      const answer = patterns[(index + 1) % patterns.length];
      return { id, category:'theory', questionType:'rhythm_listening', knowledgeId:level.knowledgeId, difficulty:level.difficulty, title:'听到的节奏是哪一个？', visual:'<div class="theory-rhythm">▶ · · ·</div>', answer:answer.label, options:shuffle(patterns.map(pattern => pattern.label)), notes:answer.notes, explanation:'先听每个音符的进入位置，再比较短时值音符的分布。' };
    }
    const pool = level.id === 'theory-1-1' ? TREBLE_NOTES.slice(0, 7) : TREBLE_NOTES;
    const note = pool[index % pool.length];
    const distractors = shuffle(TREBLE_NOTES.filter(item => item.name !== note.name)).slice(0, 3);
    return { id, category:'theory', questionType:'staff_note_identification', knowledgeId:level.knowledgeId, difficulty:level.difficulty, title:'高音谱表中，这个音是什么？', visual:svgStaffNote(note), answer:note.name, options:shuffle([note.name, ...distractors.map(item => item.name)]), explanation:`这是 ${note.name}（${note.solfege}），位于高音谱表的${note.place}。` };
  }

  function renderSummary() {
    const state = Education.getState();
    const events = state.theoryAnswerEvents || [];
    const records = Object.values(state.theoryMastery || {});
    $('theoryTotalQuestions').textContent = String(events.length);
    $('theoryAccuracy').textContent = events.length ? `${Math.round(events.filter(event => event.correct).length / events.length * 100)}%` : '—';
    $('theoryWeakCount').textContent = String(records.filter(record => record.weak).length);
  }

  function starsFor(accuracy) { return accuracy >= .9 ? 3 : accuracy >= .8 ? 2 : accuracy >= .6 ? 1 : 0; }

  function renderMap() {
    renderSummary();
    const progress = Education.getState().theoryProgress || {};
    $('theoryMap').innerHTML = CHAPTERS.map(([chapter, title, subtitle, open = true]) => {
      const levels = LEVELS.filter(level => level.chapter === chapter);
      return `<section class="theory-chapter"><div class="theory-chapter-head"><div><span class="theory-kicker">CHAPTER 0${chapter}</span><h3>${title}</h3></div><p>${subtitle}${open ? '' : ' · 即将开放'}</p></div><div class="theory-levels">${open ? levels.map(level => { const item = progress[level.id] || {}; return `<button class="theory-level" type="button" data-theory-level="${level.id}"><span class="level-number">LEVEL ${String(level.order).padStart(2,'0')}</span><b>${level.title}</b><small>${level.subtitle}</small><span class="theory-stars">${[1,2,3].map(star => star <= (item.stars || 0) ? '★' : '☆').join('')}</span></button>`; }).join('') : `<div class="theory-level locked"><span class="level-number">LOCKED</span><b>即将开放</b><small>完成前置章节后开放新的理论内容。</small></div>`}</div></section>`;
    }).join('');
    $('theoryMap').querySelectorAll('[data-theory-level]').forEach(button => button.addEventListener('click', () => showLevel(button.dataset.theoryLevel)));
  }

  function showLevel(id) {
    const level = LEVELS.find(item => item.id === id);
    if (!level) return;
    session = { level, index:0, correct:0, answers:[], startedAt:Date.now() };
    $('theoryMapView').classList.add('hidden'); $('theoryQuestionView').classList.add('hidden'); $('theoryResultView').classList.add('hidden'); $('theoryLevelView').classList.remove('hidden');
    $('theoryLevelTitle').textContent = level.title; $('theoryLevelSubtitle').textContent = level.subtitle; $('theoryLevelLesson').textContent = level.lesson;
  }

  function beginLevel() {
    if (!session) return;
    $('theoryLevelView').classList.add('hidden'); $('theoryQuestionView').classList.remove('hidden');
    renderQuestion();
  }

  function renderQuestion() {
    if (!session || session.index >= session.level.count) return completeLevel();
    locked = false;
    currentQuestion = buildQuestion(session.level, session.index);
    Education.markQuestionShown(currentQuestion);
    $('theoryQuestionCounter').textContent = `${session.index + 1} / ${session.level.count}`;
    $('theoryQuestionProgress').style.width = `${session.index / session.level.count * 100}%`;
    $('theoryQuestionTitle').textContent = currentQuestion.title;
    $('theoryQuestionVisual').innerHTML = currentQuestion.visual;
    $('theoryAnswerGrid').innerHTML = shuffle(currentQuestion.options).map(option => `<button type="button" data-theory-answer="${escapeHTML(option)}">${escapeHTML(option)}</button>`).join('');
    $('theoryAnswerGrid').querySelectorAll('button').forEach(button => button.addEventListener('click', () => answerQuestion(button.dataset.theoryAnswer, button)));
    $('theoryFeedback').textContent = ''; $('theoryFeedback').className = 'theory-feedback'; $('theoryExplanation').textContent = '';
    $('theoryPlayRhythm').classList.toggle('hidden', currentQuestion.questionType !== 'rhythm_listening');
    const stored = session.answers[session.index];
    if (stored) {
      locked = true;
      $('theoryAnswerGrid').querySelectorAll('button').forEach(button => {
        button.disabled = true;
        if (button.dataset.theoryAnswer === currentQuestion.answer) button.classList.add('correct');
        if (!stored.correct && button.dataset.theoryAnswer === stored.userAnswer) button.classList.add('wrong');
      });
      $('theoryFeedback').textContent = stored.correct ? '回答正确。' : `正确答案：${currentQuestion.answer}`;
      $('theoryFeedback').className = `theory-feedback ${stored.correct ? 'correct' : 'wrong'}`;
      $('theoryExplanation').textContent = currentQuestion.explanation;
    }
    syncQuestionNavigation(Boolean(stored));
  }

  function syncQuestionNavigation(answered) {
    const previous = $('theoryQuestionPrev');
    const next = $('theoryQuestionNext');
    if (previous) previous.disabled = !session || session.index <= 0;
    if (!next) return;
    next.disabled = !answered;
    next.textContent = session && session.index >= session.level.count - 1 ? '完成本关 →' : '下一题 →';
  }

  function playRhythm() {
    if (!currentQuestion) return;
    Education.markReplay(currentQuestion);
    App.playEarItem?.({ category:'rhythm', bpm:92, notes:currentQuestion.notes }, false);
  }

  function answerQuestion(answer, button) {
    if (locked || !currentQuestion || !session) return;
    locked = true;
    const correct = answer === currentQuestion.answer;
    $('theoryAnswerGrid').querySelectorAll('button').forEach(item => { item.disabled = true; if (item.dataset.theoryAnswer === currentQuestion.answer) item.classList.add('correct'); });
    if (!correct) button.classList.add('wrong');
    const event = Education.recordTheoryAnswer({ question:currentQuestion, questionType:currentQuestion.questionType, category:'theory', knowledgeId:currentQuestion.knowledgeId, difficulty:currentQuestion.difficulty, userAnswer:answer, correct, correctAnswer:currentQuestion.answer, levelId:session.level.id });
    session.correct += correct ? 1 : 0;
    session.answers[session.index] = { correct, userAnswer:answer, responseTime:event?.responseTime || 0, knowledgeId:currentQuestion.knowledgeId };
    $('theoryFeedback').textContent = correct ? '回答正确。' : `正确答案：${currentQuestion.answer}`;
    $('theoryFeedback').className = `theory-feedback ${correct ? 'correct' : 'wrong'}`;
    $('theoryExplanation').textContent = currentQuestion.explanation;
    syncQuestionNavigation(true);
  }

  function completeLevel() {
    if (!session) return;
    const accuracy = session.correct / session.level.count;
    const stars = starsFor(accuracy);
    Education.updateState(state => {
      const previous = state.theoryProgress[session.level.id] || {};
      state.theoryProgress[session.level.id] = { levelId:session.level.id, stars:Math.max(previous.stars || 0, stars), attempts:(previous.attempts || 0) + 1, bestAccuracy:Math.max(previous.bestAccuracy || 0, Math.round(accuracy * 100)), lastCompletedAt:Date.now() };
      if (stars) { state.learning.xp += stars * 10; state.learning.jadePoints += stars * 2; }
      return state;
    });
    $('theoryQuestionView').classList.add('hidden'); $('theoryResultView').classList.remove('hidden');
    $('theoryResultTitle').textContent = stars ? `${stars} 星通关` : '还需要再练一次';
    $('theoryResultMessage').textContent = stars ? '本关成绩已保存，薄弱知识点也会进入后续复习。' : '一星需要达到 60% 正确率，可以先复习本关说明再挑战。';
    $('theoryResultAccuracy').textContent = `${Math.round(accuracy * 100)}%`; $('theoryResultStars').textContent = [1,2,3].map(star => star <= stars ? '★' : '☆').join(''); $('theoryResultCount').textContent = `${session.correct} / ${session.level.count}`;
    const report = $('theoryChapterReport');
    if (session.level.type === 'chapter_review') {
      const groups = [...new Set(session.answers.map(item => item.knowledgeId))].map(id => {
        const answers = session.answers.filter(item => item.knowledgeId === id);
        return { id, accuracy:Math.round(answers.filter(item => item.correct).length / answers.length * 100) };
      });
      const weakest = groups.slice().sort((a,b) => a.accuracy - b.accuracy)[0];
      report.innerHTML = `<b>本章掌握情况</b>${groups.map(item => `<p>${item.id.split('.').slice(-1)[0]}：${item.accuracy}%</p>`).join('')}<p><strong>建议：</strong>${weakest ? `优先复习 ${weakest.id}，再进入专项训练。` : '继续完成后续章节。'}</p>`;
      report.classList.remove('hidden');
    } else report.classList.add('hidden');
  }

  // 发布前自检：每一道可生成题都必须有正确答案，且正确答案必须在选项中。
  function auditQuestionBank() {
    const issues = [];
    LEVELS.forEach(level => {
      for (let index = 0; index < level.count; index += 1) {
        const question = buildQuestion(level, index);
        if (!question.answer || !question.options.includes(question.answer)) {
          issues.push(`${level.id}-${index + 1}: 答案不在选项中`);
        }
        if (question.questionType === 'staff_note_identification' && !question.visual.includes('𝄞')) {
          issues.push(`${level.id}-${index + 1}: 缺少高音谱号`);
        }
      }
    });
    return issues;
  }

  function openAcademy() { renderMap(); $('theoryMapView').classList.remove('hidden'); $('theoryLevelView').classList.add('hidden'); $('theoryQuestionView').classList.add('hidden'); $('theoryResultView').classList.add('hidden'); App.showPage('theoryAcademy'); }
  $('theoryLevelBack')?.addEventListener('click', openAcademy);
  $('theoryLevelStart')?.addEventListener('click', beginLevel);
  $('theoryQuestionExit')?.addEventListener('click', openAcademy);
  $('theoryPlayRhythm')?.addEventListener('click', playRhythm);
  $('theoryQuestionPrev')?.addEventListener('click', () => { if (session && session.index > 0) { session.index -= 1; renderQuestion(); } });
  $('theoryQuestionNext')?.addEventListener('click', () => {
    if (!session?.answers?.[session.index]) return;
    if (session.index >= session.level.count - 1) completeLevel();
    else { session.index += 1; renderQuestion(); }
  });
  $('theoryResultMap')?.addEventListener('click', openAcademy);
  $('theoryResultRetry')?.addEventListener('click', () => session && showLevel(session.level.id));
  window.addEventListener('musictoolbox:pagechange', event => {
    if (event.detail.id === 'theoryAcademy') renderMap();
    else window.HetianCore?.events?.dispose('theory:transition');
  });
  const theoryAuditIssues = auditQuestionBank();
  if (theoryAuditIssues.length) console.error('乐理题库自检失败：', theoryAuditIssues);
  window.HetianTheory = { LEVELS, openAcademy, renderMap, auditQuestionBank };
})();
