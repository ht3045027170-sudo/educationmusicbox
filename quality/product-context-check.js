const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../product-context.js'), 'utf8');

function resolve(hostname, search = '') {
  let replaced = '';
  const href = `https://${hostname}/${search}`;
  const context = {
    URL,
    URLSearchParams,
    location: { hostname, search, href, pathname: '/', hash: '' },
    history: { replaceState: (_state, _title, value) => { replaced = value; } },
    window: {},
  };
  vm.runInNewContext(source, context);
  return { ...context.window.HaitangProduct, replaced };
}

assert.deepEqual(resolve('haitang-music.educationmusicbox.pages.dev', '?product=exam'), {
  product: 'music', fixed: true, hostname: 'haitang-music.educationmusicbox.pages.dev', replaced: '/',
});
assert.equal(resolve('haitang-exam.educationmusicbox.pages.dev', '?product=music').product, 'exam');
assert.equal(resolve('educationmusicbox.pages.dev', '?product=exam').product, 'exam');
assert.equal(resolve('127.0.0.1').product, 'music');
console.log('product context isolation: ok');
