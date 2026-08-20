(() => {
  'use strict';

  // 题库与页面分离：后续 500 题正式题目、教师题和模拟题均由这里加载。
  const QuestionBank = [];
  const add = question => QuestionBank.push({ source:'基础乐理', difficulty:1, options:[], explanation:'', ...question });

  [
    ['C4','高音谱表下加一线的 C4'], ['E4','高音谱表第一线的 E4'], ['G4','高音谱表第二线的 G4'], ['B4','高音谱表第三线的 B4'], ['D5','高音谱表第四线的 D5'], ['F5','高音谱表第五线的 F5']
  ].forEach(([answer, explanation], index) => add({ id:`seed-staff-${index + 1}`, category:'音符与五线谱', knowledgeId:`theory.staff.note.${answer}`, questionType:'staff_note_identification', question:'高音谱表中的指定音是什么？', options:['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5'], answer, explanation }));
  [
    ['2/4','每小节有 2 个四分音符拍'], ['3/4','每小节有 3 个四分音符拍'], ['4/4','每小节有 4 个四分音符拍'], ['6/8','每小节有 6 个八分音符']
  ].forEach(([meter, answer], index) => add({ id:`seed-rhythm-${index + 1}`, category:'节奏', knowledgeId:`theory.rhythm.meter.${meter}`, questionType:'time_signature', question:`${meter} 拍表示什么？`, options:['每小节有 2 个四分音符拍','每小节有 3 个四分音符拍','每小节有 4 个四分音符拍','每小节有 6 个八分音符'], answer, explanation:`${meter} 的上方表示每小节单位数，下方表示拍单位。` }));
  add({ id:'gd-original-interval-01', category:'广东艺考模拟', knowledgeId:'ear.interval.major_third', difficulty:3, questionType:'interval_listening', question:'播放一个上行音程后，选择其性质。', options:['小三度','大三度','纯四度','纯五度'], answer:'大三度', explanation:'原创模拟题：大三度包含四个半音。', source:'广东艺考模拟' });

  // 依据广东省 2026 音乐类统考公开科目要求（乐理与听写、视唱、器乐、声乐），
  // 以下均为原创训练题，不复刻或转写任何真题。
  const gd = (id, category, knowledgeId, questionType, question, options, answer, explanation, difficulty = 3) => add({ id, category, knowledgeId, questionType, question, options, answer, explanation, difficulty, source:'广东艺考模拟' });
  [
    ['C 大调','无升降号'], ['G 大调','升 F'], ['D 大调','升 F、C'], ['A 大调','升 F、C、G'], ['F 大调','降 B'], ['B♭ 大调','降 B、E'], ['E♭ 大调','降 B、E、A']
  ].forEach(([key, answer], index) => gd(`gd-key-${index + 1}`, '广东艺考模拟', `theory.key.signature.${key.replaceAll(' ','_')}`, 'key_signature', `${key} 的调号是什么？`, ['无升降号','升 F','升 F、C','升 F、C、G','降 B','降 B、E','降 B、E、A'], answer, `${key} 的调号为${answer}。`));
  [
    ['C 大调','a 小调'], ['G 大调','e 小调'], ['F 大调','d 小调'], ['D 大调','b 小调'], ['E♭ 大调','c 小调']
  ].forEach(([major, answer], index) => gd(`gd-relative-${index + 1}`, '广东艺考模拟', `theory.key.relative.${major.replaceAll(' ','_')}`, 'relative_key', `${major} 的关系小调是什么？`, ['a 小调','b 小调','c 小调','d 小调','e 小调'], answer, `大调的关系小调主音比该大调主音低小三度。`));
  [
    ['C–E','大三度'], ['C–E♭','小三度'], ['C–F','纯四度'], ['C–G','纯五度'], ['C–B','大七度'], ['C–B♭','小七度']
  ].forEach(([notes, answer], index) => gd(`gd-interval-${index + 1}`, '广东艺考模拟', `theory.interval.${answer}`, 'interval_identification', `音程 ${notes} 的性质是？`, ['小三度','大三度','纯四度','纯五度','小七度','大七度'], answer, `${notes} 构成${answer}。`));
  [
    ['C E G','C 大三和弦'], ['A C E','a 小三和弦'], ['B D F','B 减三和弦'], ['C E G♯','C 增三和弦'], ['C E G B','C 大七和弦'], ['G B D F','G 属七和弦']
  ].forEach(([notes, answer], index) => gd(`gd-chord-${index + 1}`, '广东艺考模拟', `theory.chord.${answer.replaceAll(' ','_')}`, 'chord_structure', `下列组成音 ${notes} 构成什么和弦？`, ['C 大三和弦','a 小三和弦','B 减三和弦','C 增三和弦','C 大七和弦','G 属七和弦'], answer, `${notes} 的音程结构对应${answer}。`, 4));
  [
    ['Allegro','快板'], ['Andante','行板'], ['Adagio','柔板'], ['Moderato','中板'], ['crescendo','渐强'], ['diminuendo','渐弱'], ['dolce','柔和地'], ['cantabile','如歌地']
  ].forEach(([term, answer], index) => gd(`gd-term-${index + 1}`, '广东艺考模拟', `theory.term.${term}`, 'music_term', `${term} 的常用含义是？`, ['快板','行板','柔板','中板','渐强','渐弱','柔和地','如歌地'], answer, `${term} 表示“${answer}”。`, 2));
  [
    ['♩ + ♪♪','2拍'], ['𝅗𝅥 + ♩ + ♩','4拍'], ['♩. + ♪','2拍'], ['♪♪ + ♪♪ + ♩','3拍']
  ].forEach(([pattern, answer], index) => gd(`gd-rhythm-${index + 1}`, '广东艺考模拟', `theory.rhythm.combo.${index + 1}`, 'note_duration', `在 4/4 拍中，${pattern} 一共占多少拍？`, ['1拍','2拍','3拍','4拍'], answer, `把每个音符换算成四分音符拍后相加即可。`, 3));

  const QuestionBankMeta = {
    version: 1,
    sources: {
      '广东艺考模拟': '原创训练内容；依据公开考试科目与能力范围设计，不使用或复制真题。'
    }
  };

  function query(filters = {}) {
    return QuestionBank.filter(question => Object.entries(filters).every(([key, value]) => value === undefined || question[key] === value));
  }
  function random(filters = {}) {
    const list = query(filters);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  window.HetianQuestionBank = { QuestionBank, QuestionBankMeta, query, random, add };
})();
