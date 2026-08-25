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
  ['聊天核对服务器当前账号', read('homework.js').includes('messages.viewer?.id') && read('functions/api/learning/[system]/classes/[classId]/messages.js').includes('viewer: { id: user.id, role: user.role }')],
  ['其他页面切换账号后自动刷新', read('auth.js').includes("event.key === 'haitang_auth_changed_at'")],
  ['消息接口校验班级成员', read('functions/api/learning/[system]/classes/[classId]/messages.js').includes('accessibleClass')],
  ['教师作业写入班级消息', read('functions/api/teaching/[system]/classes/[classId]/assignments.js').includes("'assignment'")],
  ['教师中心可打开群聊', read('admin-homework.js').includes('dataset.classChat') && read('teacher.js').includes("import('/homework.js')")],
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([label, ok]) => console.log(`${ok ? '✓' : '✗'} ${label}`));
if (failed.length) process.exit(1);
