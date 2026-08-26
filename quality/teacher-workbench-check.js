const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const workbench = read('teacher-workbench.js');
const score = read('admin-music-editor.js');
const checks = [
  ['教师中心进入真实出题工作台', read('teacher.js').includes("import('/teacher-workbench.js')")],
  ['先选题型再进入编辑器', workbench.includes('你今天想出什么题？') && workbench.includes('data-type=')],
  ['专属单音音程和弦编辑器', ['single_note','interval','chord'].every(type => workbench.includes(`${type}:`))],
  ['桌面三栏与手机页签', workbench.includes('tw-editor-grid') && workbench.includes('tw-mobile-tabs')],
  ['学生端实时预览', workbench.includes('renderPreview()') && workbench.includes('twStudentPreview')],
  ['音乐数据不保存绘图坐标', workbench.includes('musicData:{notes:') && !workbench.includes('musicData:{x:')],
  ['草稿保存不会自动送审', read('functions/api/admin/questions/[id].js').includes("body.saveMode === 'draft'")],
  ['谱面按内容计算小节宽度', score.includes('const measureWidth = bar =>')],
  ['谱面自动组织系统换行', score.includes('const systems = []') && score.includes('system.used + width >')],
  ['音高使用统一谱表位置计算', score.includes('const diatonicPos = midi =>') && score.includes('const noteY =')],
  ['谱面支持加线与符干方向', score.includes('// 加线') && score.includes('const stemUp =')],
  ['谱面不再固定输出第二行编号', !score.includes('row * 4 + slot')],
  ['谱号使用规范音乐字形', score.includes("glyph = clef === 'bass' ? '𝄢' : '𝄞'") && !score.includes('M20 1C9 15')],
  ['高低音谱号使用不同音高基准', score.includes("clef === 'bass' ? 18 : 30")],
  ['教师端保存谱号并同步学生预览', workbench.includes('clef:state.clef') && workbench.includes('state.category,state.clef')],
  ['音程和弦专属参数可保存后恢复', workbench.includes('musicData:{notes:') && workbench.includes('parameters},audioSettings') && workbench.includes('function restoreParameters()')],
];
checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
if (checks.some(([, ok]) => !ok)) process.exit(1);
