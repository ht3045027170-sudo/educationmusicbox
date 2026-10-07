// Shared answer rules for submission, review and publishing.
export function validAnswer(value) {
  return Array.isArray(value) ? value.length > 0 && value.every(v => typeof v === 'string' && v.trim()) && new Set(value.map(v => v.trim().toLowerCase())).size === value.length :
    (typeof value === 'string' && Boolean(value.trim()) && !/^(?:(?:参?见)(?:播放脚本|解析|答案|谱例|谱面|附件)|教师人工评分|待老师评分)$/.test(value.trim())) || (typeof value === 'number' && Number.isFinite(value));
}
export function validQuestionAnswer(content, type) {
  if (!validAnswer(content.answer)) return false;
  if (!['single_choice','multi_choice'].includes(type)) return true;
  const options=content.options;
  if (!Array.isArray(options) || options.length<2 || options.some(value=>typeof value!=='string'||!value.trim())) return false;
  const normalized=options.map(value=>value.trim().toLowerCase());
  if(new Set(normalized).size!==normalized.length) return false;
  const answers=type==='multi_choice'?content.answer:[content.answer];
  if(!Array.isArray(answers)||(type==='single_choice'&&Array.isArray(content.answer))) return false;
  return answers.every(value=>normalized.includes(String(value).trim().toLowerCase()));
}
export function answersEqual(actual, expected) {
  if (!validAnswer(expected) || !validAnswer(actual) || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const normalize = value => String(value).trim().toLowerCase();
  if (!Array.isArray(expected)) return normalize(actual) === normalize(expected);
  const a = actual.map(normalize).sort(), b = expected.map(normalize).sort();
  return new Set(a).size === a.length && a.length === b.length && a.every((v, i) => v === b[i]);
}
export function gradeHomework(ids, contents, answers, sections = []) {
  const weights = new Map();
  for (const section of sections) for (const item of section.questions || []) {
    const weight = Number(item.score);
    if (!Number.isFinite(weight) || weight < 0 || weights.has(Number(item.questionId))) throw new Error('题目分值配置无效，请联系老师重新发布。');
    weights.set(Number(item.questionId), weight);
  }
  let correct = 0, earned = 0, possible = 0;
  const gradedAnswers = {};
  for (const id of ids) {
    const content = contents.get(Number(id));
    if (!content || !validAnswer(content.answer)) throw new Error('作业中有题目缺少有效标准答案，请联系老师。');
    if (sections.length && !weights.has(Number(id))) throw new Error('作业题目与分值配置不一致，请联系老师。');
    const weight = weights.get(Number(id)) ?? 1;
    const answer = validAnswer(answers[id]) ? answers[id] : '';
    gradedAnswers[id] = answer;
    possible += weight;
    if (answersEqual(answer, content.answer)) { correct++; earned += weight; }
  }
  if (!possible) throw new Error('作业总分必须大于零。');
  return { correct, total: ids.length, earned, possible, score: Math.round(earned / possible * 100), gradedAnswers };
}
export async function assignmentSections(env, assignment) {
  const snapshot = await env.DB.prepare('SELECT sections_json FROM assignment_papers WHERE assignment_id=?').bind(assignment.id).first();
  if (snapshot) return JSON.parse(snapshot.sections_json);
  if (!assignment.question_set_id) return [];
  const set = await env.DB.prepare('SELECT sections_json FROM question_sets WHERE id=?').bind(assignment.question_set_id).first();
  if (!set) throw new Error('作业套题配置缺失，请联系老师。');
  return JSON.parse(set.sections_json);
}

export function studentContent(content, review = false) {
  const result = { prompt: content.prompt || content.question || '', options: content.options || [] };
  // Only authored musical data is exposed; grading metadata stays server-side.
  for (const field of ['notes', 'meter', 'bpm', 'keySignature', 'category', 'clef', 'audioSettings', 'listenOnly', 'musicError']) {
    if (content[field] !== undefined) result[field] = content[field];
  }
  if (review) { if (content.audioScript) result.audioScript = content.audioScript; result.answer = content.answer; result.explanation = content.explanation || content.analysis || ''; }
  return result;
}

export async function assignmentQuestions(env, assignment, ids) {
  const { results: frozen } = await env.DB.prepare('SELECT question_id AS id, question_type, content FROM assignment_question_snapshots WHERE assignment_id=?').bind(assignment.id).all();
  if (frozen.length) {
    const found = new Set(frozen.map(row => Number(row.id)));
    if (ids.length !== frozen.length || ids.some(id => !found.has(Number(id)))) throw new Error('作业题目快照不完整，请联系老师。');
    return { rows:canonicalRows(frozen), versioned:true };
  }
  if (!ids.length) return {rows:[],versioned:false};
  const placeholders = ids.map(() => '?').join(',');
  const { results: rows } = await env.DB.prepare(`SELECT id, question_type, content FROM questions WHERE id IN (${placeholders})`).bind(...ids).all();
  return { rows:canonicalRows(rows), versioned:false };
}

export function canonicalQuestionContent(content, type) {
  if (type !== 'multi_choice' || Array.isArray(content.answer)) return content;
  return {...content,answer:typeof content.answer === 'string' ? content.answer.split(/[|\r\n]/).map(value=>value.trim()).filter(Boolean) : content.answer};
}
function canonicalRows(rows) {
  return rows.map(row=>({...row,content:JSON.stringify(canonicalQuestionContent(JSON.parse(row.content),row.question_type))}));
}
