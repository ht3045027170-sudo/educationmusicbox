const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['学生班级入口', read('index.html').includes('id="gkOpenStudentClass"')],
  ['乐理分区入口', read('index.html').includes('id="gkTheoryLanding"') && read('index.html').includes('id="gkTheoryIntro"')],
  ['学生与教师权限分流', read('product-entry.js').includes('.gk-student-entry')],
  ['班级消息按账号判断左右', read('functions/api/learning/[system]/classes/[classId]/messages.js').includes('is_mine: Number(row.sender_id) === Number(user.id)')],
  ['切换账号后刷新聊天令牌', read('homework.js').includes("window.addEventListener('hetian:auth-changed'") && read('homework.js').includes("csrfToken = ''" )],
  ['消息发送失败后可以重试', read('homework.js').includes('button.disabled = false')],
  ['聊天核对服务器当前账号', read('homework.js').includes('messages.viewer?.id') && read('functions/api/learning/[system]/classes/[classId]/messages.js').includes('viewer: { id: user.id, role: user.role')],
  ['其他页面切换账号后自动刷新', read('auth.js').includes("event.key === 'haitang_auth_changed_at'")],
  ['消息接口校验班级成员', read('functions/api/learning/[system]/classes/[classId]/messages.js').includes('accessibleClass')],
  ['教师作业写入班级消息', read('functions/api/teaching/[system]/classes/[classId]/assignments.js').includes("'assignment'")],
  ['教师主页可直接打开群聊', read('index.html').includes('id="gkOpenTeacherClass"') && read('gaokao_system/gaokao-app.js').includes("$('gkOpenTeacherClass')")],
  ['教师中心不再重复放群聊入口', !read('admin-homework.js').includes('dataset.classChat')],
  ['嵌入出题页复用主页会话', read('teacher.js').includes("api('/api/admin/session')") && read('teacher.js').includes("body.manager?.role === 'teacher'")],
  ['群聊消息区独立滚动', read('homework.js').includes('flex:1 1 0;overflow-y:auto') && read('homework.js').includes('.message-compose{position:relative')],
  ['聊天支持历史分页与多条置顶', read('homework.js').includes('loadOlder()') && read('homework.js').includes('openPinned()') && read('functions/api/learning/[system]/classes/[classId]/messages.js').includes('has_more')],
  ['聊天支持回复搜索公告成员管理', ['replyTo','openSearch','announcement','data-add-member','data-remove-member'].every(value => read('homework.js').includes(value))],
  ['未读消息按账号与班级保存', read('functions/api/shared.js').includes('class_read_states') && read('functions/api/learning/[system]/classes.js').includes('unread_count') && read('homework.js').includes('unread-count')],
  ['作业中心支持分组筛选重做错题', ['MY ASSIGNMENTS','allow_retry','attempt-history','标准答案'].every(value => read('homework.js').includes(value))],
  ['作业删除采用软删除并保留成绩', read('functions/api/teaching/[system]/assignments/[id].js').includes('assignment_settings') && !read('functions/api/teaching/[system]/assignments/[id].js').includes('DELETE FROM homework_submissions')],
  ['套题支持分区分值与顺序', read('admin-homework.js').includes('data-set-order') && read('functions/api/teaching/[system]/sets.js').includes('sections_json') && read('functions/api/learning/[system]/assignments/[id].js').includes('question_ids')],
  ['套题可重新载入并直接保存修改', read('admin-homework.js').includes('dataset.editingSet') && read('admin-homework.js').includes("method:'PUT'") && read('functions/api/teaching/[system]/sets/[id].js').includes('UPDATE question_sets')],
  ['教师成绩页含统计与学生搜索', read('functions/api/teaching/[system]/assignments/[id]/results.js').includes('highest:') && read('admin-homework.js').includes('result-filter')],
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([label, ok]) => console.log(`${ok ? '✓' : '✗'} ${label}`));
if (failed.length) process.exit(1);
