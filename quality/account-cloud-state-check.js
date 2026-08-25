const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const auth = read('auth.js');
const api = read('functions/api/auth/state/[code].js');
const checks = [
  ['登录前下载账号状态', auth.includes('hydrateAccountState(user)')],
  ['档案保存到服务器', auth.includes('saveAccountProfile') && auth.includes('/api/auth/systems/${code}/profile')],
  ['学习变化自动同步', auth.includes("hetian:education-state") && auth.includes("hetian:gaokao-state")],
  ['不同账号隔离本机缓存', auth.includes('haitang_state_owner_${systemCode}')],
  ['退出账号清除本机账号缓存', auth.includes('clearAccountCache();')],
  ['服务端按用户和系统联合存储', api.includes('PRIMARY KEY(user_id, system_code)')],
  ['状态接口需要登录和 CSRF', api.includes('currentUser') && api.includes('verifyCsrfRequest')],
];

checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
if (checks.some(([, ok]) => !ok)) process.exit(1);
