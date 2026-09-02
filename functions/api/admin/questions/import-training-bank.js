import { json, verifyCsrfRequest, currentUser } from '../../shared.js';

const typeFor = (item) => ['multi_choice', 'true_false', 'text_input'].includes(item.type)
  ? item.type : 'single_choice';

const musicTypeFor = (item) => {
  const category = String(item.category || '');
  if (category.includes('音程')) return 'interval';
  if (category.includes('和弦')) return 'chord';
  if (category.includes('节奏')) return 'rhythm';
  if (category.includes('旋律')) return 'melody';
  return 'single_note';
};

const normalize = (item) => {
  const subject = item.domain === 'dictation' ? 'dictation' : 'theory';
  return {
    sourceId: String(item.id || '').trim(),
    subject,
    knowledgeId: String(item.knowledgeId || `gaokao.${subject}.general`).trim(),
    questionType: typeFor(item),
    difficulty: Math.min(5, Math.max(1, Number(item.difficulty) || 1)),
    sourceLabel: String(item.sourceTag || item.source || (subject === 'theory' ? '内置高考乐理题库' : '广东艺考听记题库')).trim(),
    content: {
      sourceId: String(item.id || '').trim(),
      category: String(item.category || ''),
      prompt: String(item.prompt || '').trim(),
      options: Array.isArray(item.options) ? item.options : [],
      answer: Array.isArray(item.answer) ? item.answer.join('|') : String(item.answer ?? '').trim(),
      explanation: String(item.explanation || '').trim(),
      ...(item.answerLetter ? { answerLetter: item.answerLetter } : {}),
      ...(item.audioId ? { audioId: item.audioId } : {}),
      ...(item.audioScript ? { audioScript: item.audioScript } : {}),
      ...(subject === 'dictation' ? {
        musicType: musicTypeFor(item),
        audioSettings: { timbre: 'piano-sample', playCount: 3 },
        studentSettings: { score: 2, timeLimit: 90 },
      } : { studentSettings: { score: 2, timeLimit: 90 } }),
    },
  };
};

const buildExtraTheory = () => {
  const questions = [];
  const add = (id, category, knowledgeId, prompt, options, answer, explanation, difficulty = 2) => questions.push({
    id: `gk-extra-${id}`, category, knowledgeId, difficulty, prompt, options, answer, explanation, source: '海棠艺考原创扩充题库',
  });
  const distract = (values, index) => [values[index], values[(index + 3) % values.length], values[(index + 6) % values.length], values[(index + 9) % values.length]];
  const intervals = [['纯一度',0],['小二度',1],['大二度',2],['小三度',3],['大三度',4],['纯四度',5],['三全音',6],['纯五度',7],['小六度',8],['大六度',9],['小七度',10],['大七度',11],['纯八度',12]];
  intervals.forEach(([name, semitones], index) => {
    add(`interval-semitones-${index}`, '音程', `gaokao.theory.interval.${index}`, `${name}包含几个半音？`, distract(['0个','1个','2个','3个','4个','5个','6个','7个','8个','9个','10个','11个','12个'], index), `${semitones}个`, `${name}包含${semitones}个半音。`);
    add(`interval-name-${index}`, '音程', `gaokao.theory.interval.${index}`, `在不讨论增减音程的特殊拼写时，${semitones}个半音通常对应哪个音程？`, distract(intervals.map((item) => item[0]), index), name, `十二平均律中，${semitones}个半音通常对应${name}。`);
  });
  const keys = [['C大调','无升降号','a小调'],['G大调','1个升号','e小调'],['D大调','2个升号','b小调'],['A大调','3个升号','升f小调'],['E大调','4个升号','升c小调'],['B大调','5个升号','升g小调'],['升F大调','6个升号','升d小调'],['升C大调','7个升号','升a小调'],['F大调','1个降号','d小调'],['降B大调','2个降号','g小调'],['降E大调','3个降号','c小调'],['降A大调','4个降号','f小调'],['降D大调','5个降号','降b小调'],['降G大调','6个降号','降e小调'],['降C大调','7个降号','降a小调']];
  keys.forEach(([major, signature, relative], index) => {
    add(`key-signature-${index}`, '调式调性', `gaokao.theory.key.${index}`, `${major}的调号是？`, distract(keys.map((item) => item[1]), index), signature, `${major}使用${signature}。`);
    add(`relative-key-${index}`, '调式调性', `gaokao.theory.key.relative.${index}`, `${major}的关系小调是？`, distract(keys.map((item) => item[2]), index), relative, `关系大小调使用相同调号，${major}的关系小调是${relative}。`);
  });
  const chords = [['C大三和弦','C-E-G'],['D大三和弦','D-升F-A'],['E大三和弦','E-升G-B'],['F大三和弦','F-A-C'],['G大三和弦','G-B-D'],['A大三和弦','A-升C-E'],['降B大三和弦','降B-D-F'],['c小三和弦','C-降E-G'],['d小三和弦','D-F-A'],['e小三和弦','E-G-B'],['f小三和弦','F-降A-C'],['g小三和弦','G-降B-D'],['a小三和弦','A-C-E'],['b小三和弦','B-D-升F'],['C减三和弦','C-降E-降G'],['D减三和弦','D-F-降A'],['B减三和弦','B-D-F'],['C增三和弦','C-E-升G'],['F增三和弦','F-A-升C'],['G属七和弦','G-B-D-F']];
  chords.forEach(([name, notes], index) => add(`chord-${index}`, '和弦', `gaokao.theory.chord.extra.${index}`, `${name}由哪些音组成？`, distract(chords.map((item) => item[1]), index), notes, `${name}的构成音是${notes}。`, 3));
  const terms = [['Largo','广板'],['Adagio','柔板'],['Andante','行板'],['Moderato','中板'],['Allegretto','小快板'],['Allegro','快板'],['Vivace','活泼的快板'],['Presto','急板'],['Prestissimo','最急板'],['rit.','渐慢'],['accel.','渐快'],['a tempo','恢复原速'],['pp','很弱'],['p','弱'],['mp','中弱'],['mf','中强'],['f','强'],['ff','很强'],['crescendo','渐强'],['diminuendo','渐弱'],['dolce','柔和地'],['cantabile','如歌地'],['legato','连贯地'],['staccato','断奏'],['marcato','强调地'],['espressivo','富有表情地'],['con brio','有活力地'],['sostenuto','保持地'],['subito','突然地'],['fermata','延长记号']];
  terms.forEach(([term, meaning], index) => add(`term-${index}`, '乐谱符号', `gaokao.theory.term.extra.${index}`, `${term}表示什么？`, distract(terms.map((item) => item[1]), index), meaning, `${term}的常用含义是“${meaning}”。`));
  return questions;
};

// POST /api/admin/questions/import-training-bank
// 将网页离线题库幂等同步到 D1。只允许总管理员教师执行。
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: '服务端数据库未配置（缺少 D1 绑定）。' }, 503);
  try {
    const user = await currentUser(request, env);
    if (!user || user.role !== 'admin') return json({ ok: false, error: '仅总管理员教师可同步内置题库。' }, 403);
    const csrf = await verifyCsrfRequest(request, env);
    if (!csrf.ok) return json({ ok: false, error: csrf.error }, csrf.status);

    const origin = new URL(request.url).origin;
    const [theoryResponse, guangdongResponse] = await Promise.all([
      fetch(`${origin}/gaokao_system/database/theory.json`),
      fetch(`${origin}/gaokao_system/database/guangdong_320.json`),
    ]);
    if (!theoryResponse.ok || !guangdongResponse.ok) throw new Error('无法读取内置题库文件。');
    const [theoryBank, guangdongBank] = await Promise.all([theoryResponse.json(), guangdongResponse.json()]);
    const combined = [
      ...(Array.isArray(theoryBank.questions) ? theoryBank.questions : []),
      ...(Array.isArray(guangdongBank.questions) ? guangdongBank.questions : []),
      ...buildExtraTheory(),
    ];
    const unique = [...new Map(combined.filter((item) => item?.id && item?.prompt).map((item) => [item.id, normalize(item)])).values()];

    const { results } = await env.DB.prepare("SELECT content FROM questions WHERE system_code = 'gaokao'").all();
    const existing = new Set(results.map((row) => {
      try { return JSON.parse(row.content || '{}').sourceId || ''; } catch { return ''; }
    }).filter(Boolean));
    const missing = unique.filter((item) => !existing.has(item.sourceId));

    for (let offset = 0; offset < missing.length; offset += 40) {
      const statements = missing.slice(offset, offset + 40).map((item) => env.DB.prepare(
        'INSERT INTO questions (system_code, subject, instrument, knowledge_id, question_type, difficulty, source_label, content, status, version_no, created_by) ' +
        "VALUES ('gaokao', ?, '', ?, ?, ?, ?, ?, 'published', 1, ?)"
      ).bind(item.subject, item.knowledgeId, item.questionType, item.difficulty, item.sourceLabel, JSON.stringify(item.content), user.id));
      if (statements.length) await env.DB.batch(statements);
    }

    const totals = unique.reduce((output, item) => {
      output[item.subject] = (output[item.subject] || 0) + 1;
      return output;
    }, {});
    return json({ ok: true, imported: missing.length, skipped: unique.length - missing.length, total: unique.length, totals });
  } catch (error) {
    return json({ ok: false, error: '同步内置题库失败：' + (error.message || String(error)) }, 500);
  }
}
