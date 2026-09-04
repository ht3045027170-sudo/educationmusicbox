const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('education/theory.css', 'utf8');

assert(html.includes('data-theme="light"') && html.includes('data-theme="dark"'), '缺少日间或夜间模式');
assert(!html.includes('玉石绿</button>') && !html.includes('湖水蓝</button>') && !html.includes('墨玉黑</button>'), '旧外观主题仍在设置页面');
assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), '显示模式没有按两项排版');
assert(html.includes('id="guitarFreeMode"') && html.includes("tunerMode==='free'"), '自由调音模式未接入');
assert(html.includes('parseTunerTarget(value)'), '自由调音没有使用固定输入目标');
assert(!html.includes("if(tunerMode==='free')updateFreeTunerTarget(med)"), '收音仍在自动更改自由调音目标');

const nearest = frequency => {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  return { midi, frequency: 440 * Math.pow(2, (midi - 69) / 12) };
};
assert.deepStrictEqual(nearest(440), { midi: 69, frequency: 440 });
assert(Math.abs(nearest(277).frequency - 277.1826) < 0.01, 'C♯4 最近音计算错误');

console.log('显示模式与固定目标调音检查通过');
