(() => {
  'use strict';

  const Education = window.HetianEducation;
  const App = window.HetianApp;
  if (!Education || !App) return;

  const $ = id => document.getElementById(id);
  const INTERVALS = {
    纯一度: 0,
    小二度: 1,
    大二度: 2,
    小三度: 3,
    大三度: 4,
    纯四度: 5,
    增四度: 6,
    减五度: 6,
    纯五度: 7,
    小六度: 8,
    大六度: 9,
    小七度: 10,
    大七度: 11,
    纯八度: 12
  };
  const KNOWLEDGE = {
    纯一度: 'ear.interval.unison',
    小二度: 'ear.interval.minor_second',
    大二度: 'ear.interval.major_second',
    小三度: 'ear.interval.minor_third',
    大三度: 'ear.interval.major_third',
    纯四度: 'ear.interval.perfect_fourth',
    增四度: 'ear.interval.tritone',
    减五度: 'ear.interval.tritone',
    纯五度: 'ear.interval.perfect_fifth',
    小六度: 'ear.interval.minor_sixth',
    大六度: 'ear.interval.major_sixth',
    小七度: 'ear.interval.minor_seventh',
    大七度: 'ear.interval.major_seventh',
    纯八度: 'ear.interval.octave',
    大三和弦: 'ear.chord.major_triad',
    小三和弦: 'ear.chord.minor_triad'
  };
  const LABELS = Object.fromEntries(Object.entries(KNOWLEDGE).map(([label, id]) => [id, label]));
  const ALL_INTERVAL_OPTIONS = Object.keys(INTERVALS).filter(label => label !== '减五度');

  const ASSESSMENT_BLUEPRINT = [
    ['小二度', ['小二度', '大二度', '小三度', '大三度'], 60],
    ['大二度', ['小二度', '大二度', '小三度', '大三度'], 62],
    ['小三度', ['小三度', '大三度', '纯四度', '纯五度'], 58],
    ['大三度', ['小三度', '大三度', '纯四度', '纯五度'], 61],
    ['纯四度', ['大三度', '纯四度', '增四度', '纯五度'], 57],
    ['纯五度', ['纯四度', '增四度', '纯五度', '小六度'], 59],
    ['增四度', ['纯四度', '增四度', '纯五度', '小六度'], 60],
    ['小六度', ['纯五度', '小六度', '大六度', '小七度'], 56],
    ['大六度', ['小六度', '大六度', '小七度', '大七度'], 58],
    ['大七度', ['大六度', '小七度', '大七度', '纯八度'], 56]
  ];

  const LEVELS = [
    {
      id: 'interval-1-1', chapter: 1, order: 1, title: '听见重合',
      subtitle: '同度与八度的第一印象', pool: ['纯一度', '纯八度'], difficulty: 1,
      lesson: '同度几乎完全重合；八度听起来高度相似，但空间被明显拉开。'
    },
    {
      id: 'interval-1-2', chapter: 1, order: 2, title: '认识纯八度',
      subtitle: '同名音之间的宽阔距离', pool: ['纯一度', '纯八度'], difficulty: 1,
      lesson: '八度包含十二个半音。先听两端的距离，再判断它们是否像同一个音名。'
    },
    {
      id: 'interval-1-3', chapter: 1, order: 3, title: '远近对比',
      subtitle: '同度与八度快速辨认', pool: ['纯一度', '纯八度'], difficulty: 2,
      lesson: '不要只听音色是否相似，重点判断两个音之间是否存在明显跨度。'
    },
    {
      id: 'interval-1-4', chapter: 1, order: 4, title: '声音距离挑战',
      subtitle: '第一章综合关', pool: ['纯一度', '纯八度', '纯五度'], difficulty: 2,
      lesson: '加入纯五度作为干扰，检验你能否稳定判断声音距离。', boss: true
    },
    {
      id: 'interval-2-1', chapter: 2, order: 5, title: '纯四度',
      subtitle: '紧凑、稳定又带一点悬念', pool: ['纯四度', '纯五度'], difficulty: 1,
      lesson: '纯四度包含五个半音。和纯五度相比，它更紧一些。'
    },
    {
      id: 'interval-2-2', chapter: 2, order: 6, title: '纯五度',
      subtitle: '开阔而稳定的支撑感', pool: ['纯四度', '纯五度'], difficulty: 1,
      lesson: '纯五度包含七个半音。不要只记感觉，也要熟悉实际距离。'
    },
    {
      id: 'interval-2-3', chapter: 2, order: 7, title: '四度与五度',
      subtitle: '只差两个半音的稳定音程', pool: ['纯四度', '增四度', '纯五度'], difficulty: 2,
      lesson: '先抓住纯四度与纯五度，再让三全音作为不稳定的中间干扰。'
    },
    {
      id: 'interval-2-4', chapter: 2, order: 8, title: '稳定音程挑战',
      subtitle: '第二章综合关', pool: ['纯一度', '纯四度', '纯五度', '纯八度'], difficulty: 3,
      lesson: '从四个稳定音程中判断准确距离。', boss: true
    },
    {
      id: 'interval-3-1', chapter: 3, order: 9, title: '小三度',
      subtitle: '三个半音的核心距离', pool: ['小三度', '大三度'], difficulty: 1,
      lesson: '小三度包含三个半音。情绪色彩只能辅助，距离记忆才是核心。'
    },
    {
      id: 'interval-3-2', chapter: 3, order: 10, title: '大三度',
      subtitle: '四个半音的明亮张力', pool: ['小三度', '大三度'], difficulty: 1,
      lesson: '大三度比小三度宽一个半音。反复对比这一个半音的差异。'
    },
    {
      id: 'interval-3-3', chapter: 3, order: 11, title: '大小三度对比',
      subtitle: '高考听辨核心基础', pool: ['小二度', '小三度', '大三度', '纯四度'], difficulty: 2,
      lesson: '把大小三度放进相邻音程中辨认，避免只靠二选一猜测。'
    },
    {
      id: 'interval-3-4', chapter: 3, order: 12, title: '三度世界挑战',
      subtitle: '第三章综合关', pool: ['大二度', '小三度', '大三度', '纯四度'], difficulty: 3,
      lesson: '完成后，你将建立大小三度的第一份稳定训练记录。', boss: true
    }
  ];

  let assessmentQuestions = [];
  let assessmentQuestion = null;
  let assessmentLocked = false;
  let assessmentIndex = 0;
  let challenge = null;
  let challengeQuestion = null;
  let challengeLocked = false;
  let transitionTimer = 0;
  function clearTransition() {
    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = 0;
    window.HetianCore?.events?.dispose('education:transition');
  }
  function scheduleTransition(callback, delay) {
    clearTransition();
    const scope = window.HetianCore?.events?.scope('education:transition');
    if (scope) {
      scope.timeout(() => { transitionTimer = 0; callback(); }, delay);
      return;
    }
    transitionTimer = setTimeout(() => { transitionTimer = 0; callback(); }, delay);
  }

  function today() {
    return Education.isoDate();
  }

  function intervalQuestion(answer, options, root, source, levelId = '') {
    return {
      id: `${source}-${answer}-${root}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: 'interval',
      title: '请选择听到的和声音程',
      root,
      notes: [{ midi: root, dur: 2 }, { midi: root + INTERVALS[answer], dur: 2 }],
      answer,
      options: [...options],
      difficulty: options.length >= 4 ? 2 : 1,
      _educationSource: source,
      _educationLevelId: levelId
    };
  }

  function chordQuestion(answer, root, source) {
    const shapes = {
      大三和弦: [0, 4, 7],
      小三和弦: [0, 3, 7]
    };
    return {
      id: `${source}-${answer}-${root}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: 'chord',
      title: '请选择听到的三和弦',
      root,
      notes: shapes[answer].map(distance => ({ midi: root + distance, dur: 2 })),
      answer,
      options: ['大三和弦', '小三和弦'],
      difficulty: 1,
      _educationSource: source
    };
  }

  function shuffle(values) {
    const output = [...values];
    for (let index = output.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [output[index], output[swap]] = [output[swap], output[index]];
    }
    return output;
  }

  function buildAssessmentQuestions() {
    const intervals = ASSESSMENT_BLUEPRINT.map(([answer, options, root]) =>
      intervalQuestion(answer, options, root, 'assessment')
    );
    return [
      ...intervals,
      chordQuestion('大三和弦', 58, 'assessment'),
      chordQuestion('小三和弦', 60, 'assessment')
    ];
  }

  function ensureDailyPlan(force = false) {
    if (!Education.profileExists()) return null;
    const state = Education.getState();
    if (!force && state.dailyPlans[today()]) return state.dailyPlans[today()];

    const minutes = state.profile.dailyMinutes || 20;
    const mastery = Object.values(state.mastery || {});
    const weak = mastery
      .filter(record => record.attempts >= 1)
      .sort((a, b) => a.masteryScore - b.masteryScore)[0];
    const strong = mastery
      .filter(record => record.attempts >= 3)
      .sort((a, b) => b.masteryScore - a.masteryScore)[0];
    const weakLabel = LABELS[weak?.knowledgeId] || state.profile.selfReportedWeaknesses[0] || '音程';
    const strongLabel = LABELS[strong?.knowledgeId] || '基础听觉';
    const taskMinutes = allocateTaskMinutes(minutes);
    const plan = {
      date: today(),
      generatedAt: Date.now(),
      estimatedMinutes: minutes,
      reasonSummary: weak
        ? `${weakLabel}当前掌握度较低，今天优先安排对比与巩固。`
        : '还没有足够答题数据，今天先建立基础听辨样本。',
      status: 'active',
      completedTasks: 0,
      tasks: [
        {
          id: `warmup-${today()}`, type: 'warmup', title: `${strongLabel}快速热身`,
          subtitle: '唤醒已接触的声音距离', minutes: taskMinutes[0],
          knowledgeIds: strong ? [strong.knowledgeId] : [], status: 'pending'
        },
        {
          id: `main-${today()}`, type: 'main', title: '音程主线挑战',
          subtitle: '继续当前可解锁关卡', minutes: taskMinutes[1],
          knowledgeIds: [], status: 'pending'
        },
        {
          id: `weak-${today()}`, type: 'weak', title: `${weakLabel}重点巩固`,
          subtitle: weak ? `掌握度 ${weak.masteryScore} 分，优先复习` : '完成初测后自动细化',
          minutes: taskMinutes[2],
          knowledgeIds: weak ? [weak.knowledgeId] : [], status: 'pending'
        },
        {
          id: `check-${today()}`, type: 'comprehensive', title: '今日综合回顾',
          subtitle: '用少量综合题检查迁移', minutes: taskMinutes[3],
          knowledgeIds: [], status: 'pending'
        }
      ]
    };
    Education.updateState(next => {
      next.dailyPlans[today()] = plan;
      return next;
    });
    return plan;
  }

  function allocateTaskMinutes(totalMinutes) {
    const total = Math.max(10, Number(totalMinutes) || 20);
    const weights = [0.2, 0.35, 0.3, 0.15];
    const minimums = [2, 3, 3, 2];
    const result = weights.map((weight, index) =>
      Math.max(minimums[index], Math.floor(total * weight))
    );
    const growthOrder = [1, 2, 0, 3];
    let difference = total - result.reduce((sum, value) => sum + value, 0);
    let cursor = 0;

    while (difference > 0) {
      result[growthOrder[cursor % growthOrder.length]] += 1;
      cursor += 1;
      difference -= 1;
    }

    cursor = 0;
    while (difference < 0 && cursor < 100) {
      const index = growthOrder[cursor % growthOrder.length];
      if (result[index] > minimums[index]) {
        result[index] -= 1;
        difference += 1;
      }
      cursor += 1;
    }

    return result;
  }

  function unlocked(level, progress) {
    // 创作者测试权限开启时，音程岛所有主线关和章节挑战均可直接进入；关闭后立即恢复正常前置关规则。
    if (window.LicenseManager?.canAccess?.('advanced_level')) return true;
    if (level.order === 1) return true;
    const previous = LEVELS.find(item => item.order === level.order - 1);
    return Number(progress[previous?.id]?.stars || 0) >= 1;
  }

  function recommendedLevel() {
    const state = Education.getState();
    const progress = state.levelProgress || {};
    return LEVELS.find(level => unlocked(level, progress) && !progress[level.id]?.stars)
      || LEVELS.filter(level => unlocked(level, progress)).at(-1)
      || LEVELS[0];
  }

  function startAssessment(options = {}) {
    clearTimeout(transitionTimer);
    const state = Education.getState();
    if (state.onboarding.assessmentCompleted && !options.restart) {
      renderAssessmentReport(state.assessment.summary);
      App.showPage('eduAssessment');
      return;
    }
    assessmentQuestions = buildAssessmentQuestions();
    const resumeIndex = options.restart ? 0 : Math.min(
      state.assessment.currentIndex || 0,
      assessmentQuestions.length - 1
    );
    if (options.restart) {
      Education.updateState(next => {
        next.assessment = {
          status: 'in-progress',
          startedAt: Date.now(),
          completedAt: 0,
          currentIndex: 0,
          answers: [],
          summary: null
        };
        next.onboarding.assessmentCompleted = false;
        return next;
      });
    } else if (state.assessment.status !== 'in-progress') {
      Education.updateState(next => {
        next.assessment.status = 'in-progress';
        next.assessment.startedAt = Date.now();
        next.assessment.currentIndex = 0;
        next.assessment.answers = [];
        return next;
      });
    }
    App.showPage('eduAssessment');
    $('eduAssessmentIntro').classList.add('hidden');
    $('eduAssessmentReport').classList.add('hidden');
    $('eduAssessmentQuestion').classList.remove('hidden');
    renderAssessmentQuestion(resumeIndex);
  }

  function renderAssessmentQuestion(index) {
    assessmentLocked = false;
    const state = Education.getState();
    const answers = state.assessment.answers || [];
    const storedIndex = Math.max(0, Math.min(index, assessmentQuestions.length - 1));
    if (answers.length >= assessmentQuestions.length && storedIndex >= assessmentQuestions.length - 1) {
      completeAssessment();
      return;
    }
    assessmentIndex = storedIndex;
    assessmentQuestion = assessmentQuestions[storedIndex];
    Education.markQuestionShown(assessmentQuestion);
    $('eduAssessmentProgress').style.width = `${storedIndex / assessmentQuestions.length * 100}%`;
    $('eduAssessmentCounter').textContent = `${storedIndex + 1} / ${assessmentQuestions.length}`;
    $('eduAssessmentType').textContent = assessmentQuestion.category === 'chord' ? '和弦听辨' : '音程听辨';
    $('eduAssessmentPrompt').textContent = assessmentQuestion.title;
    $('eduAssessmentFeedback').textContent = '初测只用于建立起点，请凭第一判断作答。';
    $('eduAssessmentFeedback').dataset.state = '';
    $('eduAssessmentAnswers').innerHTML = shuffle(assessmentQuestion.options).map(option =>
      `<button type="button" data-assessment-answer="${option}">${option}</button>`
    ).join('');
    $('eduAssessmentAnswers').querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => answerAssessment(button.dataset.assessmentAnswer, button));
    });
    const stored = answers[storedIndex];
    if (stored) {
      assessmentLocked = true;
      $('eduAssessmentAnswers').querySelectorAll('button').forEach(button => {
        button.disabled = true;
        if (button.dataset.assessmentAnswer === assessmentQuestion.answer) button.classList.add('correct');
        if (!stored.isCorrect && button.dataset.assessmentAnswer === stored.userAnswer) button.classList.add('wrong');
      });
      $('eduAssessmentFeedback').textContent = stored.isCorrect ? '判断正确。你可以查看解析后再进入下一题。' : `正确答案是${assessmentQuestion.answer}；你的选择是${stored.userAnswer}。`;
      $('eduAssessmentFeedback').dataset.state = stored.isCorrect ? 'correct' : 'wrong';
    }
    syncAssessmentNavigation(Boolean(stored));
  }

  function syncAssessmentNavigation(answered) {
    const previous = $('eduAssessmentPrev');
    const next = $('eduAssessmentNext');
    if (previous) previous.disabled = assessmentIndex <= 0;
    if (!next) return;
    next.disabled = !answered;
    next.textContent = assessmentIndex >= assessmentQuestions.length - 1 ? '查看初测报告 →' : '下一题 →';
  }

  function playAssessment() {
    if (!assessmentQuestion) return;
    Education.markReplay(assessmentQuestion);
    App.playEarItem(assessmentQuestion, true);
  }

  function answerAssessment(answer, button) {
    if (assessmentLocked || !assessmentQuestion) return;
    assessmentLocked = true;
    const correct = answer === assessmentQuestion.answer;
    $('eduAssessmentAnswers').querySelectorAll('button').forEach(item => {
      item.disabled = true;
      if (item.dataset.assessmentAnswer === assessmentQuestion.answer) item.classList.add('correct');
    });
    if (!correct) button.classList.add('wrong');
    const event = Education.recordAnswer({
      question: assessmentQuestion,
      userAnswer: answer,
      isCorrect: correct,
      source: 'assessment'
    });
    Education.updateState(state => {
      state.assessment.answers.push({
        questionId: event?.questionId || assessmentQuestion.id,
        knowledgeId: KNOWLEDGE[assessmentQuestion.answer] || '',
        correctAnswer: assessmentQuestion.answer,
        userAnswer: answer,
        isCorrect: correct,
        responseMs: event?.responseMs || 0
      });
      state.assessment.currentIndex = state.assessment.answers.length;
      return state;
    });
    $('eduAssessmentFeedback').textContent = correct
      ? '判断正确。'
      : `正确答案是${assessmentQuestion.answer}；你的选择是${answer}。`;
    $('eduAssessmentFeedback').dataset.state = correct ? 'correct' : 'wrong';
    syncAssessmentNavigation(true);
  }

  function completeAssessment() {
    const state = Education.getState();
    const answers = state.assessment.answers || [];
    const byKnowledge = {};
    answers.forEach(answer => {
      const id = answer.knowledgeId || 'unknown';
      byKnowledge[id] = byKnowledge[id] || { attempts: 0, correct: 0 };
      byKnowledge[id].attempts += 1;
      byKnowledge[id].correct += answer.isCorrect ? 1 : 0;
    });
    const summary = {
      total: answers.length,
      correct: answers.filter(answer => answer.isCorrect).length,
      accuracy: answers.length
        ? Math.round(answers.filter(answer => answer.isCorrect).length / answers.length * 100)
        : 0,
      byKnowledge,
      generatedAt: Date.now()
    };
    Education.updateState(next => {
      next.assessment.status = 'completed';
      next.assessment.completedAt = Date.now();
      next.assessment.summary = summary;
      next.onboarding.assessmentCompleted = true;
      next.learning.xp += 25;
      return next;
    });
    ensureDailyPlan(true);
    renderAssessmentReport(summary);
  }

  function renderAssessmentReport(summary = Education.getState().assessment.summary) {
    if (!summary) {
      $('eduAssessmentIntro').classList.remove('hidden');
      $('eduAssessmentQuestion').classList.add('hidden');
      $('eduAssessmentReport').classList.add('hidden');
      return;
    }
    const state = Education.getState();
    const records = Object.values(state.mastery || {})
      .filter(record => record.attempts > 0)
      .sort((a, b) => b.masteryScore - a.masteryScore);
    const strong = records.slice(0, 3);
    const weak = [...records].reverse().slice(0, 3);
    $('eduAssessmentIntro').classList.add('hidden');
    $('eduAssessmentQuestion').classList.add('hidden');
    $('eduAssessmentReport').classList.remove('hidden');
    $('eduAssessmentScore').textContent = `${summary.accuracy}%`;
    $('eduAssessmentScoreText').textContent = `答对 ${summary.correct} / ${summary.total} 题`;
    $('eduAssessmentStrong').innerHTML = strong.length
      ? strong.map(record => `<li><b>${LABELS[record.knowledgeId] || record.knowledgeId}</b><span>${record.masteryScore} 分</span></li>`).join('')
      : '<li><span>暂无足够数据</span></li>';
    $('eduAssessmentWeak').innerHTML = weak.length
      ? weak.map(record => `<li><b>${LABELS[record.knowledgeId] || record.knowledgeId}</b><span>${record.masteryScore} 分</span></li>`).join('')
      : '<li><span>暂无足够数据</span></li>';
  }

  function renderMap() {
    const state = Education.getState();
    const progress = state.levelProgress || {};
    const chapters = [
      [1, '第一章 · 声音距离', '从同度与八度建立空间感'],
      [2, '第二章 · 稳定音程', '掌握纯四度与纯五度'],
      [3, '第三章 · 三度世界', '高考听辨的核心基础']
    ];
    $('eduMapChapters').innerHTML = chapters.map(([chapter, title, subtitle]) => {
      const levels = LEVELS.filter(level => level.chapter === chapter);
      return `
        <section class="edu-map-chapter">
          <header><span>0${chapter}</span><div><h2>${title}</h2><p>${subtitle}</p></div></header>
          <div class="edu-level-path">
            ${levels.map((level, index) => {
              const isUnlocked = unlocked(level, progress);
              const result = progress[level.id] || {};
              const recommended = recommendedLevel().id === level.id;
              return `
                <button type="button" class="edu-level-node ${level.boss ? 'boss' : ''} ${isUnlocked ? '' : 'locked'} ${recommended ? 'recommended' : ''}"
                  data-level-id="${level.id}" ${isUnlocked ? '' : 'disabled'}>
                  <span class="edu-node-index">${result.stars ? '✓' : level.order}</span>
                  <span class="edu-node-copy"><b>${level.title}</b><small>${level.subtitle}</small></span>
                  <span class="edu-stars" aria-label="${result.stars || 0} 星">${[1,2,3].map(star => star <= (result.stars || 0) ? '★' : '☆').join('')}</span>
                </button>
                ${index < levels.length - 1 ? '<i class="edu-path-line" aria-hidden="true"></i>' : ''}
              `;
            }).join('')}
          </div>
        </section>
      `;
    }).join('');
    $('eduMapChapters').querySelectorAll('[data-level-id]').forEach(button => {
      button.addEventListener('click', () => showLevelIntro(button.dataset.levelId));
    });
  }

  function openMap() {
    renderMap();
    App.showPage('eduMap');
  }

  function levelById(id) {
    return LEVELS.find(level => level.id === id);
  }

  function showLevelIntro(levelId) {
    const level = levelById(levelId);
    if (!level) return;
    const state = Education.getState();
    if (!unlocked(level, state.levelProgress || {})) return;
    challenge = {
      level,
      index: 0,
      total: level.boss ? 10 : 8,
      correct: 0,
      results: [],
      startedAt: Date.now(),
      completed: false
    };
    $('eduChallengeActive').classList.add('hidden');
    $('eduChallengeResult').classList.add('hidden');
    $('eduChallengeIntro').classList.remove('hidden');
    $('eduChallengeChapter').textContent = `第 ${level.chapter} 章 · 第 ${level.id.split('-').at(-1)} 关`;
    $('eduChallengeTitle').textContent = level.title;
    $('eduChallengeSubtitle').textContent = level.subtitle;
    $('eduChallengeLesson').textContent = level.lesson;
    $('eduChallengeGoal').textContent = `完成 ${challenge.total} 道题，正确率达到 60% 即可一星通关。`;
    $('eduPreviewSounds').innerHTML = [...new Set(level.pool)].slice(0, 4).map(label =>
      `<button type="button" data-preview-interval="${label}">▶ ${label}</button>`
    ).join('');
    $('eduPreviewSounds').querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        const answer = button.dataset.previewInterval;
        App.playEarItem(intervalQuestion(answer, [answer], 60, 'preview', level.id), false);
      });
    });
    App.showPage('eduChallenge');
  }

  function buildLevelQuestion(level, index) {
    const answer = level.pool[index % level.pool.length];
    const root = 56 + (index * 3 + level.order) % 10;
    let options = [...new Set(level.pool)];
    const nearby = ALL_INTERVAL_OPTIONS
      .filter(label => label !== answer && !options.includes(label))
      .sort((a, b) => Math.abs(INTERVALS[a] - INTERVALS[answer]) - Math.abs(INTERVALS[b] - INTERVALS[answer]));
    const targetCount = level.difficulty >= 2 ? 4 : Math.max(2, Math.min(3, options.length + 1));
    options = shuffle([...options, ...nearby]).filter((value, idx, list) => list.indexOf(value) === idx);
    if (!options.includes(answer)) options.unshift(answer);
    options = options.slice(0, targetCount);
    if (!options.includes(answer)) options[options.length - 1] = answer;
    return intervalQuestion(answer, options, root, 'level', level.id);
  }

  function beginChallenge() {
    if (!challenge) return;
    challenge.index = 0;
    challenge.correct = 0;
    challenge.results = [];
    challenge.startedAt = Date.now();
    $('eduChallengeIntro').classList.add('hidden');
    $('eduChallengeResult').classList.add('hidden');
    $('eduChallengeActive').classList.remove('hidden');
    renderChallengeQuestion();
  }

  function renderChallengeQuestion() {
    if (!challenge || challenge.index >= challenge.total) {
      completeChallenge();
      return;
    }
    challengeLocked = false;
    challengeQuestion = buildLevelQuestion(challenge.level, challenge.index);
    Education.markQuestionShown(challengeQuestion);
    $('eduChallengeProgress').style.width = `${challenge.index / challenge.total * 100}%`;
    $('eduChallengeCounter').textContent = `${challenge.index + 1} / ${challenge.total}`;
    $('eduChallengeLiveTitle').textContent = challenge.level.title;
    $('eduChallengeFeedback').textContent = '播放音程后，选择你听到的答案。';
    $('eduChallengeFeedback').dataset.state = '';
    $('eduChallengeAnswers').innerHTML = shuffle(challengeQuestion.options).map(option =>
      `<button type="button" data-challenge-answer="${option}">${option}</button>`
    ).join('');
    $('eduChallengeAnswers').querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => answerChallenge(button.dataset.challengeAnswer, button));
    });
    const stored = challenge.results[challenge.index];
    if (stored) {
      challengeLocked = true;
      $('eduChallengeAnswers').querySelectorAll('button').forEach(button => {
        button.disabled = true;
        if (button.dataset.challengeAnswer === challengeQuestion.answer) button.classList.add('correct');
        if (!stored.correct && button.dataset.challengeAnswer === stored.userAnswer) button.classList.add('wrong');
      });
      $('eduChallengeFeedback').textContent = stored.correct ? '判断正确。你可以查看解析后再进入下一题。' : `正确答案：${challengeQuestion.answer}。你选择了${stored.userAnswer}。`;
      $('eduChallengeFeedback').dataset.state = stored.correct ? 'correct' : 'wrong';
    }
    syncChallengeNavigation(Boolean(stored));
  }

  function syncChallengeNavigation(answered) {
    const previous = $('eduChallengePrev');
    const next = $('eduChallengeNextQuestion');
    if (previous) previous.disabled = !challenge || challenge.index <= 0;
    if (!next) return;
    next.disabled = !answered;
    next.textContent = challenge && challenge.index >= challenge.total - 1 ? '完成本关 →' : '下一题 →';
  }

  function playChallenge() {
    if (!challengeQuestion) return;
    Education.markReplay(challengeQuestion);
    App.playEarItem(challengeQuestion, true);
  }

  function answerChallenge(answer, button) {
    if (challengeLocked || !challengeQuestion) return;
    challengeLocked = true;
    const correct = answer === challengeQuestion.answer;
    $('eduChallengeAnswers').querySelectorAll('button').forEach(item => {
      item.disabled = true;
      if (item.dataset.challengeAnswer === challengeQuestion.answer) item.classList.add('correct');
    });
    if (!correct) button.classList.add('wrong');
    const event = Education.recordAnswer({
      question: challengeQuestion,
      userAnswer: answer,
      isCorrect: correct,
      source: 'level',
      levelId: challenge.level.id
    });
    challenge.correct += correct ? 1 : 0;
    challenge.results[challenge.index] = {
      correct,
      responseMs: event?.responseMs || 0,
      answer: challengeQuestion.answer,
      userAnswer: answer
    };
    $('eduChallengeFeedback').textContent = correct
      ? '判断正确。保持这个声音距离。'
      : `正确答案：${challengeQuestion.answer}。你选择了${answer}。`;
    $('eduChallengeFeedback').dataset.state = correct ? 'correct' : 'wrong';
    syncChallengeNavigation(true);
  }

  function completeChallenge() {
    if (!challenge || challenge.completed) return;
    challenge.completed = true;
    const accuracy = challenge.correct / challenge.total;
    const averageResponseMs = Math.round(
      challenge.results.reduce((sum, result) => sum + result.responseMs, 0)
      / Math.max(1, challenge.results.length)
    );
    const stars = accuracy >= .9 && averageResponseMs <= 5000 ? 3 : accuracy >= .8 ? 2 : accuracy >= .6 ? 1 : 0;
    const previousStars = Education.getState().levelProgress[challenge.level.id]?.stars || 0;
    Education.updateState(state => {
      state.levelProgress[challenge.level.id] = {
        levelId: challenge.level.id,
        stars: Math.max(previousStars, stars),
        bestAccuracy: Math.max(
          state.levelProgress[challenge.level.id]?.bestAccuracy || 0,
          Math.round(accuracy * 100)
        ),
        bestAverageResponseMs: Math.min(
          state.levelProgress[challenge.level.id]?.bestAverageResponseMs || Infinity,
          averageResponseMs
        ),
        attempts: (state.levelProgress[challenge.level.id]?.attempts || 0) + 1,
        lastCompletedAt: Date.now()
      };
      if (stars > previousStars) {
        state.learning.xp += stars * 20;
        state.learning.jadePoints += stars * 5;
      }
      const plan = state.dailyPlans[today()];
      const task = plan?.tasks?.find(item => item.status !== 'completed');
      if (task && stars >= 1) {
        task.status = 'completed';
        task.completedAt = Date.now();
        plan.completedTasks = plan.tasks.filter(item => item.status === 'completed').length;
        if (plan.completedTasks === plan.tasks.length) plan.status = 'completed';
      }
      return state;
    });
    $('eduChallengeActive').classList.add('hidden');
    $('eduChallengeIntro').classList.add('hidden');
    $('eduChallengeResult').classList.remove('hidden');
    $('eduResultTitle').textContent = stars ? `${stars} 星通关` : '还差一点';
    $('eduResultStars').textContent = [1,2,3].map(star => star <= stars ? '★' : '☆').join('');
    $('eduResultAccuracy').textContent = `${Math.round(accuracy * 100)}%`;
    $('eduResultSpeed').textContent = `${(averageResponseMs / 1000).toFixed(1)} 秒`;
    $('eduResultMessage').textContent = stars
      ? '已保存关卡成绩，并更新知识点掌握度和今日训练进度。'
      : '正确率达到 60% 即可解锁下一关；可以先重听教学示例再挑战。';
  }

  function startDailyPlan() {
    const state = Education.getState();
    if (!state.onboarding.assessmentCompleted) {
      App.showPage('eduAssessment');
      renderAssessmentReport(null);
      return;
    }
    ensureDailyPlan();
    showLevelIntro(recommendedLevel().id);
  }

  function showAssessmentIntro() {
    App.showPage('eduAssessment');
    $('eduAssessmentIntro').classList.remove('hidden');
    $('eduAssessmentQuestion').classList.add('hidden');
    $('eduAssessmentReport').classList.add('hidden');
  }

  $('eduAssessmentBegin')?.addEventListener('click', () => startAssessment({ restart: false }));
  $('eduAssessmentRestart')?.addEventListener('click', () => startAssessment({ restart: true }));
  $('eduAssessmentPlay')?.addEventListener('click', playAssessment);
  $('eduAssessmentPrev')?.addEventListener('click', () => { if (assessmentIndex > 0) renderAssessmentQuestion(assessmentIndex - 1); });
  $('eduAssessmentNext')?.addEventListener('click', () => {
    const answers = Education.getState().assessment.answers || [];
    if (!answers[assessmentIndex]) return;
    if (assessmentIndex >= assessmentQuestions.length - 1) completeAssessment();
    else renderAssessmentQuestion(assessmentIndex + 1);
  });
  $('eduAssessmentToMap')?.addEventListener('click', openMap);
  $('eduAssessmentHome')?.addEventListener('click', () => {
    window.HetianEducationUI?.renderDashboard();
    App.showPage('eduDashboard');
  });
  $('eduMapHome')?.addEventListener('click', () => {
    window.HetianEducationUI?.renderDashboard();
    App.showPage('eduDashboard');
  });
  $('eduChallengeBack')?.addEventListener('click', openMap);
  $('eduChallengeBegin')?.addEventListener('click', beginChallenge);
  $('eduChallengePlay')?.addEventListener('click', playChallenge);
  $('eduChallengePrev')?.addEventListener('click', () => { if (challenge && challenge.index > 0) { challenge.index -= 1; renderChallengeQuestion(); } });
  $('eduChallengeNextQuestion')?.addEventListener('click', () => {
    if (!challenge?.results?.[challenge.index]) return;
    if (challenge.index >= challenge.total - 1) completeChallenge();
    else { challenge.index += 1; renderChallengeQuestion(); }
  });
  $('eduChallengeRetry')?.addEventListener('click', () => showLevelIntro(challenge?.level.id));
  $('eduChallengeNext')?.addEventListener('click', () => {
    const next = LEVELS.find(level => level.order === (challenge?.level.order || 0) + 1);
    if (next && unlocked(next, Education.getState().levelProgress || {})) showLevelIntro(next.id);
    else openMap();
  });
  $('eduChallengeResultHome')?.addEventListener('click', () => {
    window.HetianEducationUI?.renderDashboard();
    App.showPage('eduDashboard');
  });
  $('eduOpenMap')?.addEventListener('click', openMap);
  $('eduOpenAssessmentReport')?.addEventListener('click', () => {
    const state = Education.getState();
    if (state.onboarding.assessmentCompleted && state.assessment.summary) {
      App.showPage('eduAssessment');
      renderAssessmentReport(state.assessment.summary);
    } else {
      showAssessmentIntro();
    }
  });

  window.addEventListener('musictoolbox:pagechange', event => {
    if (!['eduAssessment', 'eduChallenge'].includes(event.detail.id)) clearTransition();
    if (event.detail.id === 'eduMap') renderMap();
  });

  window.HetianLearningFlow = {
    LEVELS,
    ensureDailyPlan,
    startAssessment,
    showAssessmentIntro,
    renderAssessmentReport,
    openMap,
    renderMap,
    showLevelIntro,
    startDailyPlan,
    recommendedLevel
  };
})();
