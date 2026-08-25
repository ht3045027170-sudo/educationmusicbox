const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const login = read('functions/api/auth/login.js');
const register = read('functions/api/auth/register.js');
const entry = read('product-entry.js');
const auth = read('auth.js');

const checks = [
  ['登录不按产品拆分账号', !login.includes('AND learning_system = ?')],
  ['注册时用户名和邮箱全局唯一', !register.includes('AND learning_system = ?')],
  ['艺考入口接受统一账号', !entry.includes("user.learningSystem !== 'gaokao'")],
  ['两边账户中心显示同一登录用户', auth.includes('const accountUser = user || null;')],
];

for (const [name, passed] of checks) {
  if (!passed) throw new Error(`统一账号检查失败：${name}`);
}

console.log(`统一账号检查通过（${checks.length}/${checks.length}）`);
