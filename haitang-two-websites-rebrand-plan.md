# Plan: 海棠音乐与海棠艺考双网页拆分及整体更名

**Generated**: 2026-08-24
**Estimated Complexity**: High

## Overview

将当前同时承载“音乐爱好者”和“高考音乐生”的单页应用拆成两个可独立访问、独立注册、独立保存学习数据的网页产品：

- **海棠音乐**：面向普通音乐爱好者；保留免费体验版与会员制度，不提供教师中心。
- **海棠艺考**：面向音乐艺考生；提供学生账号与教师账号，保留教师中心，不再向产品用户提供管理员账号。

两个网页共享调音器、节拍器、模拟钢琴、和弦查询、制谱、MIDI、音频引擎、钢琴采样等底层资源。第一阶段继续使用原生 HTML/CSS/JavaScript 和现有 Cloudflare Functions/D1，不引入新框架，也不复制两套公共工具代码。

旧版仍处于内测，允许清空旧学习数据，因此本次不做复杂的旧档案自动迁移；部署前保留一次完整备份和旧版访问入口，验证完成后再切换正式入口。

## Confirmed Product Rules

1. 先拆成两个网页，不立即拆 Windows/Android 安装包。
2. 全局品牌更名：
   - 音乐爱好者系统 → **海棠音乐**
   - 高考音乐生系统 / 和田玉艺考 → **海棠艺考**
   - “和田玉音乐工具箱”不再作为产品品牌出现；通用工具区域统一称“音乐工具”或“工具箱”。
3. 两个网站分别注册，账号和会话互不复用。
4. 两个网站都保留全部通用音乐工具。
5. 海棠音乐：普通用户、免费体验、会员权限；无教师中心。
6. 海棠艺考：学生、教师；有教师中心；不再提供管理员账号入口。
7. 允许清空现有内测学习档案和训练记录。
8. 所有可见文字、按钮、提示、注释性说明必须与当前功能一致；失效、重复、占位或无法执行的文字和控件应删除。

## Target Structure

```text
/
├── index.html                  # 简洁产品选择页，仅进入两个产品
├── haitang-music/
│   └── index.html              # 海棠音乐独立网页
├── haitang-exam/
│   └── index.html              # 海棠艺考独立网页
├── shared/
│   ├── core/                   # 路由、页面生命周期、存储、错误处理
│   ├── auth/                   # 共用表单与 API 客户端，不共享会话
│   ├── tools/                  # 通用音乐工具
│   ├── audio/                  # Web Audio、钢琴/吉他采样
│   ├── styles/                 # 设计变量与通用组件
│   └── assets/                 # 图标、字体、图片
├── music/                      # 海棠音乐专属业务模块
├── exam/                       # 海棠艺考专属业务模块
├── teacher/                    # 海棠艺考教师中心
└── functions/api/              # Cloudflare API，按产品隔离
```

首轮可以在不移动全部旧文件的情况下先建立两个入口，再逐步抽离现有 `index.html`。每个阶段都保持可运行，避免一次性重写 40 万字节的主页面。

## Data and Permission Model

### 海棠音乐

```text
product_code: haitang_music
roles: user
plans: trial | member
storage namespace: haitang_music_*
session cookie: haitang_music_session
```

- 免费体验版通过 `plan` 和服务器返回的功能列表控制。
- 会员判断不能只写在前端；离线版可缓存最近一次有效权限，但必须标记缓存时间和离线状态。
- 不显示教师注册、教师登录、审题、作业发布或管理员入口。

### 海棠艺考

```text
product_code: haitang_exam
roles: student | teacher
storage namespace: haitang_exam_*
session cookie: haitang_exam_session
```

- 学生只能访问学习、练习、成绩、错题和个人档案。
- 教师访问教师中心、题库维护、审题、作业和学生数据。
- 原管理员审题能力中真正需要的部分迁移给教师中心的“题库负责人”权限；登录日志、封禁等平台运维能力不出现在普通网页中。
- 题库与学习记录必须带 `product_code`，服务器端强制校验，不接受前端自行指定越权访问另一个产品的数据。

### 注册隔离

- 同一个邮箱可以分别在两个产品注册，但生成两套独立产品账号关系和会话。
- 登录接口必须明确产品来源，不能依赖页面传入后未经验证直接切换产品。
- 两个网站的“退出登录”只退出本产品。

## Sprint 0: 冻结、备份与品牌清单

**Goal**: 为大改动建立可回退基线，并找全所有品牌、权限和失效文案。

**Demo/Validation**:

- 当前版本仍可从保留入口运行。
- 生成品牌替换表、页面清单、存储键清单和 API 清单。
- Git 工作区只包含计划内变更。

### Task 0.1: 建立拆分基线

- **Location**: repository root, Git tag/branch
- **Description**: 记录当前 commit，建立拆分开发分支和旧版归档标记；导出当前 D1 结构与本地数据键清单。
- **Dependencies**: None
- **Acceptance Criteria**:
  - 能明确恢复到拆分前版本。
  - 不提交签名文件、构建产物或用户隐私数据。
- **Validation**: 使用干净工作区检出归档版本并启动一次。

### Task 0.2: 建立全局更名矩阵

- **Location**: `index.html`, `auth.js`, `offline-first.js`, `education/`, `gaokao_system/`, `sight-singing/`, `score/`, `studio-one/`, `teacher.*`, `admin.*`, `functions/api/`, documentation
- **Description**: 搜索“和田玉、和田玉艺考、音乐爱好者、高考音乐生、HETIAN JADE、MUSIC TOOLBOX”等旧品牌；给每一处标记“改名、保留为通用名、删除”三种处理方式。
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - 页面标题、下载文件名、备份格式说明、MIDI 默认名、调音器琴头字样、错误提示、邮件文本和后台文案全部进入清单。
  - 不机械替换音乐知识正文中的普通词语。
- **Validation**: 全仓搜索旧品牌，仅允许归档/迁移说明中出现。

### Task 0.3: 清理无效内容规则

- **Location**: all user-facing HTML/JS
- **Description**: 列出没有事件、指向未开放功能、含错误状态、重复解释、无意义英文装饰和已失效管理员提示的元素。
- **Dependencies**: Task 0.2
- **Acceptance Criteria**:
  - 每个保留按钮都有动作、禁用原因或明确开放状态。
  - 删除文字不造成布局空洞或无障碍标签缺失。
- **Validation**: 自动检查按钮目标，人工逐页核对文案与实际功能。

## Sprint 1: 两个独立网页外壳

**Goal**: 用户通过两个独立 URL 进入两个独立产品，不再在应用内部切换模式。

**Demo/Validation**:

- `/haitang-music/` 只展示海棠音乐。
- `/haitang-exam/` 只展示海棠艺考。
- 根页面只负责产品选择，不加载两套完整业务脚本。
- 两个网页都能进入全部通用音乐工具。

### Task 1.1: 创建产品入口和路由边界

- **Location**: `index.html`, `haitang-music/index.html`, `haitang-exam/index.html`
- **Description**: 创建轻量根入口和两个产品页面；删除产品内部“切换到另一个系统”的按钮。
- **Dependencies**: Sprint 0
- **Acceptance Criteria**:
  - 两个页面可直接刷新和深链接访问。
  - URL、页面标题、页头和设置页品牌一致。
- **Validation**: 分别从桌面、手机竖屏和横屏打开三个 URL。

### Task 1.2: 拆分页面加载清单

- **Location**: product HTML script/style includes
- **Description**: 海棠音乐只加载乐器学习及共享工具；海棠艺考只加载乐理、听记、视唱、考试及共享工具。
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - 海棠音乐不加载高考题库和考试模块。
  - 海棠艺考不加载吉他学习路线等爱好者专属模块。
  - 公共工具不复制源文件。
- **Validation**: 浏览器资源列表和全局对象检查。

### Task 1.3: 替换模式路由

- **Location**: current `HetianSettings`, global `[data-page]` navigation, education and gaokao routers
- **Description**: 删除对 `hetianyu_mode` 的产品切换依赖；每个产品使用自身固定根页面和返回路径。
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - 工具页“返回”始终返回当前产品的工具箱或首页。
  - 不再出现因旧 mode 值进入另一个产品的情况。
- **Validation**: 遍历所有工具进入/返回路径，刷新后复测。

### Task 1.4: 共享工具生命周期保护

- **Location**: shared audio/router/event modules and current inline JS
- **Description**: 抽出页面离开时统一停止播放、节拍器、麦克风和动画的钩子，供两个产品调用。
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - 两个产品中的调音器、节拍器、钢琴、和弦、制谱、MIDI 等功能一致。
  - 返回或切页后没有声音继续播放。
- **Validation**: 每个音频工具执行“播放→返回→重新进入”回归。

## Sprint 2: 全局品牌更名与文案瘦身

**Goal**: 所有实际可见内容完成海棠品牌替换，并删除不再有效的提示和装饰文字。

**Demo/Validation**:

- 海棠音乐页面只出现该品牌或通用工具名称。
- 海棠艺考页面只出现该品牌或通用工具名称。
- 无旧品牌残留、无乱码、无空按钮、无错误承诺。

### Task 2.1: 海棠音乐品牌替换

- **Location**: hobby/education pages, settings, auth, backups, download names
- **Description**: 将所有爱好者端标题、欢迎语、设置、备份、文件名和辅助文本统一为“海棠音乐”。
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - 不再显示“音乐爱好者系统”“和田玉音乐学习系统”等旧产品名。
  - “工具箱”只作为功能区域名称出现。
- **Validation**: 页面截图审查和字符串扫描。

### Task 2.2: 海棠艺考品牌替换

- **Location**: `gaokao_system/`, exam pages, settings, teacher center, auth, backups
- **Description**: 将高考端统一为“海棠艺考”，清理“和田玉艺考”“高考音乐生系统”等旧品牌。
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - 训练、报告、题库、视唱和教师中心使用统一品牌。
  - “高考音乐生”只作为用户群描述，不作为产品标题。
- **Validation**: 页面截图审查和字符串扫描。

### Task 2.3: 删除失效文案与控件

- **Location**: both product pages
- **Description**: 删除无功能按钮、无效管理员入口、过时的“即将开放”、与实际权限不符的解释、重复英文装饰和不可执行提示；保留必要无障碍文本。
- **Dependencies**: Tasks 2.1–2.2
- **Acceptance Criteria**:
  - 页面上的每句话能解释当前状态或引导真实动作。
  - 已锁定功能说明准确标明条件，开放功能不再显示过时锁定文字。
- **Validation**: 逐页文案—行为对照表。

## Sprint 3: 独立注册、会话和学习数据

**Goal**: 两个产品分别注册、登录和保存数据，不会相互读取或覆盖。

**Demo/Validation**:

- 可用同一邮箱分别注册海棠音乐和海棠艺考。
- 登录其中一个不会登录另一个。
- 清除其中一个产品的数据不会删除另一个产品数据。

### Task 3.1: 数据库产品隔离

- **Location**: Cloudflare D1 schema/migrations, `functions/api/auth/*`
- **Description**: 将账号唯一约束调整为产品范围；所有用户、档案、会话、题库、答案和报告记录绑定 `product_code`。
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - 同一邮箱可在两个产品分别注册。
  - 服务端拒绝跨产品会话和数据访问。
- **Validation**: API 集成测试覆盖同邮箱双注册与越权请求。

### Task 3.2: 独立 Cookie 与前端会话

- **Location**: `auth.js`, API session handlers
- **Description**: 两产品使用不同会话 Cookie 名或严格绑定产品的服务端会话；页面不再提供账号系统切换。
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - 两个网页可同时保持不同登录状态。
  - 任一产品退出不影响另一产品。
- **Validation**: 同浏览器双标签登录/退出测试。

### Task 3.3: 本地存储命名空间

- **Location**: `offline-first.js`, education state, gaokao state, settings and progress stores
- **Description**: 将所有键迁移到 `haitang_music_*` 或 `haitang_exam_*`，并拆分备份格式。
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - 清除海棠音乐数据不会影响海棠艺考。
  - 导入文件只能导入匹配产品，错误文件有明确提示。
- **Validation**: 保存、刷新、导出、清除、导入、再次刷新测试。

### Task 3.4: 内测数据重置

- **Location**: first-run reset/migration guard
- **Description**: 在新品牌首次打开时明确说明内测结构已升级；仅在用户确认后清除旧状态键，不静默删除题库、乐谱、MIDI 或用户文件。
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - 学习档案可重建。
  - 自制内容和工具项目不会被误删。
- **Validation**: 准备旧键样本，执行升级并核对保留/删除范围。

## Sprint 4: 产品权限重构

**Goal**: 海棠音乐采用免费体验/会员，海棠艺考采用学生/教师，不再暴露管理员账号。

**Demo/Validation**:

- 海棠音乐没有教师或管理员入口。
- 海棠艺考教师能维护题库和作业，学生不能进入教师页面。
- 不存在仅靠修改前端变量即可越权的路径。

### Task 4.1: 海棠音乐会员模型

- **Location**: license manager, account profile, permission API, music UI
- **Description**: 将现有通用 license 逻辑收敛为 `trial/member`，建立统一 `canUse(feature)` 接口；服务器返回会员状态，前端只负责展示。
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - 免费体验功能和会员功能清单可配置。
  - 离线时展示最近授权状态及更新时间。
- **Validation**: trial/member/过期/离线四种状态测试。

### Task 4.2: 海棠艺考学生与教师角色

- **Location**: auth API, `teacher.html`, `teacher.js`, question/homework modules
- **Description**: 将角色限制为 `student/teacher`；教师注册默认待审核或使用邀请码，避免任何人自助获得题库修改权限。
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - 学生无法访问教师接口。
  - 教师可按乐理、听记、视唱维护题目并查看审核状态。
- **Validation**: 角色权限矩阵 API 测试和页面直达测试。

### Task 4.3: 移除产品管理员账号

- **Location**: `admin.html`, `admin.js`, admin routes, sight-singing hidden admin UI
- **Description**: 删除面向产品用户的管理员登录和入口；将必要题库审核能力迁移到教师中心。平台安全维护接口若仍需保留，应改为部署侧私有运维能力，不出现在公开网站。
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - 公开页面和注册流程无管理员角色。
  - 原审题能力没有因删除管理员 UI 而丢失。
- **Validation**: 搜索管理员入口、角色枚举和路由；验证教师审题完整流程。

## Sprint 5: 题库、记录与教师中心归属

**Goal**: 业务数据真正按产品隔离，并简化不属于对应产品的管理功能。

**Demo/Validation**:

- 海棠音乐只访问乐器学习相关题库和个人进度。
- 海棠艺考访问高考题库、听记、视唱、模拟考试、错题与教师功能。
- 教师修改艺考题目不会影响海棠音乐。

### Task 5.1: 题库产品标签和 API 过滤

- **Location**: question bank JSON/data import, D1 questions, `/api/questions/*`
- **Description**: 为所有题目明确 `product_code`、科目、知识点、状态和作者；服务端按当前会话产品过滤。
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - 请求不能通过更改查询参数读取另一产品题库。
  - 现有题目完成归属检查，无悬空题目。
- **Validation**: 数据审计脚本和 API 越权测试。

### Task 5.2: 海棠音乐学习记录

- **Location**: music theory/progress modules
- **Description**: 保留个人学习进度、错题和会员内容，不加载教师布置或审题模型。
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - 学习记录只属于当前海棠音乐账号。
  - 游客体验和登录后同步边界明确。
- **Validation**: 游客→注册→同步以及多账号切换测试。

### Task 5.3: 海棠艺考教师中心收敛

- **Location**: teacher center and exam APIs
- **Description**: 教师中心只管理海棠艺考；提供题目新增、编辑、停用、审核、作业和学生结果查看，不出现海棠音乐筛选项。
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - 教师中心没有跨产品选项。
  - 题目修改保留审核记录和操作者。
- **Validation**: 完整执行“创建题目→审核→发布→学生作答→教师查看”。

## Sprint 6: 发布与回归

**Goal**: 两个网页可独立部署，现有音乐工具没有功能倒退。

**Demo/Validation**:

- Cloudflare Pages 上两个 URL 均可直接访问。
- 桌面、手机竖屏、手机横屏正常。
- 两套登录、数据、权限与工具回归通过。

### Task 6.1: Cloudflare 路由与部署

- **Location**: Pages configuration, redirects/routes, Functions bindings
- **Description**: 首选同一 Pages 项目下的两个路径，先降低部署复杂度；稳定后再决定是否拆成两个 Pages 项目和独立域名。
- **Dependencies**: Sprints 1–5
- **Acceptance Criteria**:
  - 深链接刷新不返回 404。
  - 两个产品调用同一后端时仍按产品隔离。
- **Validation**: 生产预览环境冒烟测试。

### Task 6.2: 公共工具回归

- **Location**: shared tools/audio
- **Description**: 在两个产品分别测试调音器、节拍器、钢琴、听音、和弦、MIDI、制谱、视唱及音频停止行为。
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - 两端工具能力一致。
  - 钢琴采样加载成功；无重复播放、离页继续播放或事件重复绑定。
- **Validation**: 两产品共用回归清单各执行一次。

### Task 6.3: 双重完整性检查

- **Location**: full repository and deployed pages
- **Description**: 按用户要求完成两轮独立检查：第一轮检查功能和数据，第二轮检查品牌、文案、响应式和无效元素。
- **Dependencies**: Tasks 6.1–6.2
- **Acceptance Criteria**:
  - 第一轮：注册、登录、学习、保存、工具、教师中心、权限均通过。
  - 第二轮：无旧品牌、乱码、无效按钮、错误批注、跨产品数据或控制台错误。
- **Validation**: 保存两轮检查记录和发现项处理结果。

## Testing Strategy

### Automated checks

- JavaScript 语法检查。
- HTML 中重复 ID、缺失资源和按钮目标检查。
- 品牌残留字符串扫描。
- 数据库/API 产品越权测试。
- 权限矩阵测试：海棠音乐 trial/member；海棠艺考 student/teacher。
- 本地存储清除范围和导入格式测试。

### Manual checks

- 新用户分别注册两个产品。
- 同邮箱双注册、双标签同时登录、分别退出。
- 两端建立档案，刷新后保持。
- 只清除一个产品的数据。
- 所有工具进入、使用、返回、停止声音。
- 海棠艺考教师创建、审核、发布题目。
- 手机竖屏、手机横屏、桌面宽屏。
- Cloudflare 深链接刷新和弱网/离线提示。

## Potential Risks & Gotchas

1. **“分别注册”不等于必须复制用户表**：可继续使用一套 D1，但唯一约束、会话和所有查询必须加入 `product_code`。
2. **删除管理员账号不能删除安全审计**：公开管理员 UI 可以取消，但教师改题仍需记录操作者、时间和改动；平台封禁等运维能力应留在非公开路径或 Cloudflare 控制面。
3. **会员不能仅由 localStorage 决定**：否则用户可直接修改前端值解锁。离线缓存只作为临时授权副本。
4. **两个路径仍共享同一域名存储**：本地键和 Cookie 必须显式分产品；未来拆成两个域名时再处理跨域迁移。
5. **全局改名不能只改页面标题**：备份文件名、错误信息、MIDI 导出名、琴头装饰、英文副标题、教师中心、API 响应和文档都需要检查。
6. **公共工具不能复制两份**：否则两边音频修复和功能升级会逐渐不一致。
7. **清空旧数据需要区分学习数据与创作文件**：允许清空学习档案不等于删除用户制谱、MIDI、自制题库和图片。
8. **现有 `index.html` 体积大且高度耦合**：必须采用逐页搬迁和短周期验收，禁止一次重写后整体替换。

## Rollback Plan

- 拆分前创建 Git 归档标记并保留旧版静态入口。
- 每个 Sprint 独立提交，任何阶段可回退到上一可运行版本。
- 数据库变更使用新增列/新表迁移，验证完成前不删除旧列。
- 新品牌部署先使用预览 URL；两轮检查通过后再切换正式入口。
- 旧学习数据清除必须由用户确认；部署侧保留匿名结构备份，不备份用户密码明文或签名密钥。
