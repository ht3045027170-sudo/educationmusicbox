# 和田玉音乐教育工具箱 - 内测0.0.1 完整项目文档

> 本文档包含项目架构、API 接口、Git 历史、开发全程记录，供移交其他 AI 或后续维护参考。

---

## 一、项目概览

| 项目 | 值 |
|------|-----|
| 项目名 | 和田玉音乐教育工具箱-内测0.0.1 |
| 线上地址 | https://educationmusicbox.pages.dev/ |
| GitHub 仓库 | github.com/ht3045027170-sudo/educationmusicbox |
| 本地路径 | G:\和田玉音乐工具箱项目\和田玉音乐教育工具箱-内测0.0.1 |
| 部署平台 | Cloudflare Pages (Git 连接自动构建) |
| 数据库 | Cloudflare D1 (SQLite) — 数据库名「音乐盒数据库」 |
| Git 账号 | ht3045027170-sudo |
| 教师入口 | https://educationmusicbox.pages.dev/teacher.html |
| 学生入口 | https://educationmusicbox.pages.dev/ (index.html) |
| 管理后台 | https://educationmusicbox.pages.dev/admin.html |

---

## 二、三端架构

```
学生端 (index.html)     → homework.js + education/* + gaokao_system/*
教师端 (teacher.html)    → teacher.js + admin-questions.js + admin-homework.js + admin-music-editor.js
管理端 (admin.html)      → admin.js (平台管理，目前基础功能)
```

三端共享 `mb_sid` Cookie + D1 数据库，通过角色区分：
- `learner` — 学生，只能访问 learning API
- `teacher` — 教师，可访问 teaching API + admin/questions API
- `admin` — 管理员，全部权限

---

## 三、完整文件清单

### 前端核心文件

| 文件 | 说明 |
|------|------|
| index.html (388KB) | 学生端主页面，含高考系统/视唱/音乐理论/人声识谱/制谱MIDI实验室 |
| teacher.html | 教师门户页面 |
| teacher.js | 教师门户控制器（会话检查→登录→角色校验→加载模块） |
| admin.html | 管理后台页面 |
| admin.js | 管理后台逻辑 |
| admin.css | 管理/教师端共享样式 |
| auth.js | 登录/注册对话框组件（学生端共享） |
| auth.css | 认证组件样式 |
| homework.js | 学生端作业系统前端 |
| admin-questions.js | 教师端题库管理（出题/编辑/预览/审核） |
| admin-homework.js | 教师端教学管理（班级/学生/作业/成绩） |
| admin-music-editor.js | 音乐编辑器（模拟键盘+MIDI+五线谱录入+播放） |

### 前端模块目录

| 目录 | 说明 |
|------|------|
| core/ | 音频管理、事件管理、路由、状态、存储 (5个文件) |
| education/ | 教育模块（学习、UI、状态、题库、理论、吉他理论、许可证） |
| gaokao_system/ | 高考音乐系统（听记、乐理、视唱、数据库） |
| sight-singing/ | 视唱模块（钢琴采样、PDF查看器） |
| vocal-pitch/ | 人声识谱（音高检测、五线谱渲染、调音器） |
| studio-one/ | 制谱MIDI实验室（MIDI文件处理、工作室） |
| music_theory_database/ | 音乐理论数据库（吉他基础/和弦/指板/音程/节奏） |
| score/ | 乐谱相关 |
| quality/ | 质量检测相关 |

### 后端 API (Cloudflare Pages Functions)

```
functions/api/
├── shared.js                          # 共享工具：CSRF校验、会话、角色鉴权
├── csrf.js                            # GET 获取CSRF令牌
├── auth/
│   ├── session.js                     # GET 当前会话状态
│   ├── login.js                       # POST 登录（CSRF保护）
│   ├── logout.js                      # POST 登出（CSRF保护）
│   ├── register.js                    # POST 注册（强制learner角色）
│   ├── verify-email.js                # POST 邮箱验证
│   ├── forgot-password.js             # POST 忘记密码（CSRF保护）
│   ├── reset-password.js              # POST 重置密码
│   ├── resend-verification.js         # POST 重发验证邮件（CSRF保护）
│   ├── systems.js                     # GET 系统列表
│   └── systems/[code]/profile.js      # GET/PUT 用户档案
├── admin/
│   ├── session.js                     # GET 教师会话桥接（复用主站Cookie）
│   ├── logout.js                      # POST 管理后台退出
│   └── questions/
│       ├── index.js                   # GET 题库列表 / POST 创建草稿
│       ├── [id].js                    # GET 详情 / PUT 存新版本送审
│       └── [id]/review.js             # POST 审核流（submit/approve/request_changes/publish/archive）
├── teaching/[system]/
│   ├── classes.js                     # GET 班级列表 / POST 创建班级（自动生成邀请码）
│   ├── classes/[classId].js           # DELETE 删除班级（级联清空）
│   ├── classes/[classId]/students.js  # GET 学生名单
│   ├── classes/[classId]/students/[studentId].js  # DELETE 移除学生（连带删提交）
│   ├── classes/[classId]/assignments.js  # GET 作业列表 / POST 发布作业
│   ├── assignments/[id].js            # DELETE 删除作业
│   ├── assignments/[id]/results.js    # GET 成绩表（含标准答案+逐题明细）
│   └── questions.js                   # GET 已发布题库
├── learning/[system]/
│   ├── assignments.js                 # GET 我的作业列表
│   ├── classes/join.js                # POST 凭邀请码加入班级
│   ├── assignments/[id].js            # GET 作业详情（未提交隐藏答案）
│   └── assignments/[id]/submit.js     # POST 提交判分（过期拦截/重复409）
└── omr/
    ├── health.js                      # GET 健康检查
    └── recognize.js                   # POST OMR识别
```

---

## 四、数据库设计 (D1 SQLite)

### 表结构

**users** — 用户表
- id, email, password_hash, password_salt, role (learner/teacher/admin), email_verified, created_at

**sessions** — 会话表
- token (PK), user_id (NULLABLE), csrf_token, expires_at, verify_type, created_at

**questions** — 题库表
- id, system_code, subject, knowledge_id, question_type, difficulty, content (JSON), status (draft/pending_review/approved/published/archived), version_no, created_by, created_at, updated_at
- 待补充列: instrument, source_label, review_notes

**classes** — 班级表
- id, system_code, class_name, invite_code (6位), teacher_user_id, created_at

**class_students** — 班级学生表
- id, class_id, student_user_id, joined_at

**homework_assignments** — 作业表
- id, class_id, title, question_ids (JSON数组), start_time, end_time, created_at

**homework_submissions** — 提交表
- id, assignment_id, student_user_id, answers (JSON), score, wrong_count, submitted_at

---

## 五、关键技术决策

### 5.1 Import 路径深度公式
```
functions/api 下第 N 层目录的文件需要 (N-1) 个 ../ 回到 api/
```
- `functions/api/shared.js` → `./shared.js` (0层)
- `functions/api/auth/login.js` → `../shared.js` (1层)
- `functions/api/teaching/[system]/classes.js` → `../../shared.js` (2层)
- `functions/api/teaching/[system]/classes/[classId]/students.js` → `../../../shared.js` (3层)

### 5.2 CSRF 防护
- 所有 POST 接口强制校验 `X-CSRF-Token` 头
- 令牌从 Cookie session 中获取，通过 `verifyCsrfRequest()` 统一校验
- 无令牌/过期/不匹配统一返回 403

### 5.3 角色鉴权
- `currentUser()` — 从 Cookie 取 session → 查 D1 → 返回用户信息
- `requireTeacher()` — 检查角色，非 teacher/admin 返回 403
- learning API 只需登录，teaching/admin API 需要 teacher+

### 5.4 判分规则
- 提交格式：`{question_id: answer}` 对象
- 答案比对：`trim()` + `大小写不敏感`
- 多选题答案用 `|` 分隔
- 判断题答案：`正确` 或 `错误`
- 未提交时作业详情隐藏 answer/explanation 字段（防作弊）

### 5.5 教师门户架构
- `teacher.js` 通过 `window.CONTENT_MANAGER` 驱动复用 admin-questions.js / admin-homework.js
- `CONTENT_MANAGER` 包含: system, user, nav, dashboard, api
- 非教师角色登录后自动登出并提示无权限

### 5.6 音乐编辑器 (admin-music-editor.js)
- 模拟钢琴键盘 C3-C6，鼠标/触摸点击
- Web MIDI API 硬件键盘接入
- 电脑键盘：A-L 白键 / W-P 黑键 / 空格播放
- 五线谱 SVG 实时渲染（调号、拍号、小节线）
- 调号：C/G/D/A/E/F/Bb/Eb
- 节拍：4/4, 3/4, 2/4, 3/8, 6/8
- 时值：全/二分/四分/八分/十六分/三连音 + 附点
- 和弦模式：多键同按录入纵向音组
- 播放复用 sight-singing/piano-sampler.js 的 HetianPiano (Salamander 钢琴采样)
- signature 格式与 gaokao-dictation.js 判分完全兼容 (midi/dur/rest/bar)

### 5.7 出题规律
- 知识点 ID 格式：`{科目}-{主题}-{序号}` (如 `theory-interval-01`)
- 题型：single_choice / multi_choice / true_false / text_input
- 听写题：用音乐编辑器录入五线谱（notes 数组），不再用 audioScript 文字脚本
- 听写题 content 字段：notes, meter, bpm, keySignature, category
- 乐理题：保持文字编辑模式

---

## 六、Git 提交历史

```
9e0348c  教师端出题系统新增音乐编辑器：模拟键盘+MIDI接入+五线谱录入
6ad2bf4  教师端独立门户 + 取消按钮修复 + 出题指南与预览
969ed39  移除学生时同步清除其在本班的作业提交记录
37acd2b  教师端大升级：题库出题/审核流 API + 班级删除/移除学生/删除作业 + 成绩逐题明细
d3af620  新增 /api/admin/session 与 /api/admin/logout：复用主站登录态
8da8876  修复 3 个深层文件的 shared.js 导入路径深度
f43dbe1  安全修复：公开注册强制 learner 角色，防止自封管理员
c2b1d8b  新增作业系统后端：教师班级管理/发布作业/成绩 + 学生加入班级/做作业/自动判分
d1b3353  安全加固：所有认证类 POST 接口强制校验会话 CSRF 令牌
26881a6  fix: 匿名会话 user_id 改为 NULL
25f4c87  fix: 修正 shared.js 相对路径深度
9b45e9a  fix: _shared.js 改名为 shared.js（下划线开头被 Pages Functions 排除）
4f96fa0  内测0.0.1: 网页版 + D1后端Functions (auth/csrf/omr)
```

---

## 七、测试数据

### 测试账号
| 角色 | 邮箱 | 用户名 | 说明 |
|------|------|--------|------|
| 学生 | e2e-student-01@mytest.local | e2e_student_01 | 提交格式错误得 0 分 |
| 学生 | e2e-student-02@mytest.local | e2e_student_02 | 正确格式得 100 分 |
| 教师 | 3045027170@qq.com | (用户账号) | 已在 D1 升级为 teacher |

### 测试班级
- 班级名：123456（gaokao 系统）
- 邀请码：9FBA7B
- 遗留作业：id=1/id=2 截止日期已过期（测试数据）

---

## 八、待办/遗留事项

1. D1 待执行 SQL：`ALTER TABLE questions ADD COLUMN instrument TEXT; ADD COLUMN source_label TEXT; ADD COLUMN review_notes TEXT;`
2. 遗留测试作业 id=1/id=2 截止日期过期，可清理
3. admin API 的 login-logs / banned-ips / memberships 管理接口尚未实现
4. 音乐编辑器学生端答题界面尚未实现（学生端需要能查看五线谱并答题）
5. OMR 识别服务 (/api/omr/recognize) 目前返回 ready:false
6. Service Worker 尚未实现

---

## 九、开发全程记录

### 第一阶段：项目初始化 (8月18日 22:00-23:10)

**源项目**: `G:\和田玉音乐工具箱项目\和田玉音乐教育工具箱-v1.15.0-GitHub上传版`

**操作**:
1. 复制 116 个网页必需文件 (9.7MB) 到新版本目录
2. 修复 index.html 中"考试省份"下拉框：将"何欣只允许在广东省"替换为完整省级行政区列表
3. 清理：去除 .bat 脚本、.zip 备份、educationmusicbox-* 备份文件夹、cloud-omr-service (Docker)、offline-omr-engine (Python) 等服务端组件
4. 版本号统一更新为"内测0.0.1"（index.html 标题、关于软件、视唱模块标记）
5. 代码审查：12 类问题（P0:2项, P1:4项, P2:6项）
   - 关键发现：21处 /api/ 调用无后端、index.html 388KB 巨石文件、无 Service Worker、117处 innerHTML
   - 优点：零 console.log、零 eval、try-catch 覆盖率高、无障碍基础好

### 第二阶段：后端 API 搭建 (8月18日 22:51-23:55)

**用户操作**: 在 Cloudflare 创建 D1 数据库「音乐盒数据库」

**Functions 首批 13 个文件**:
- shared.js (共享工具)
- csrf.js (CSRF令牌)
- auth/ 目录下 10 个文件 (session, login, logout, register, verify-email, forgot-password, reset-password, resend-verification, systems, systems/[code]/profile)

**项目迁移**: 从 C 盘工作区迁移到 G 盘 (128 文件, 9.7MB)

**GitHub 推送**: force push 到 github.com/ht3045027170-sudo/educationmusicbox

**踩坑1 — Pages 直传模式**: push 后线上无变化，发现 Pages 项目是 Direct Upload 模式未连 Git。用户重建 Pages 项目连接 GitHub。

**踩坑2 — 下划线文件名**: `_shared.js` 被 Cloudflare Pages Functions 构建排除（下划线开头文件不参与构建），10 个文件 import 解析失败。修复：改名为 `shared.js`，更新 11 个文件的 import 路径。(commit 9b45e9a)

**踩坑3 — Import 路径深度**: `shared.js` 相对路径深度错误。修复：api/ 下文件应为 `../`，csrf 应为 `./`。(commit 25f4c87)

**踩坑4 — user_id 外键**: 匿名会话 user_id=0 违反外键约束。修复：user_id 改插 NULL。用户在 D1 Console 重建 sessions 表使 user_id 可空。(commit 26881a6)

**部署成功**: 首页 200, /api/auth/session 200 返回 `{user:null}`

### 第三阶段：CSRF 安全加固 (8月18日深夜)

- sessions 表重建：user_id 改为可空 NULL
- commit d1b3353: shared.js 新增 `verifyCsrfRequest()`，login/logout/register/forgot-password/resend-verification 五个 POST 接口强制校验 X-CSRF-Token 头
- verify-email / reset-password 为邮件 token 制，不做会话 CSRF 校验
- 线上验证通过：/api/csrf 返回令牌、无 CSRF 头被 403 拦截

### 第四阶段：作业系统后端 (8月19日 00:00-00:40)

**commit c2b1d8b**: 新增 10 个 Functions 文件
- teaching/: classes, classes/[classId], classes/[classId]/students, classes/[classId]/students/[studentId], classes/[classId]/assignments, assignments/[id], assignments/[id]/results, questions
- learning/: assignments, classes/join, assignments/[id], assignments/[id]/submit

**表结构**: questions, classes, class_students, homework_assignments, homework_submissions

**安全修复** (commit f43dbe1): register.js 原来允许自选 admin 角色 → 强制 learner；teacher/admin 需 D1 手动授权

**Import 路径修复** (commit 8da8876): 3 个 4 层深文件需要 4 个 `../`（students/[classId]、assignments/results）

**E2E 大联调通过**:
- 注册 → 邮箱验证 → 登录 → 学生作业列表 → 加班级 → 权限隔离验证
- 班级「123456」(邀请码 9FBA7B) → e2e_student_01 提交格式错误得 0 分 → e2e_student_02 正确格式得 100 分
- 验证：过期作业拦截、重复提交 409、答案隐藏防作弊、多学生成绩表

### 第五阶段：管理后台桥接 (8月19日 00:35)

**commit d3af620**: /api/admin/session 复用主站 mb_sid Cookie，teacher/admin 角色返回 manager → admin.html 自动进入教师中心
- 教师账号 3045027170@qq.com 已在 D1 升级角色

### 第六阶段：教师端大升级 (8月19日 00:55)

**commits 37acd2b + 969ed39**:
- 题库 API: 列表(分页/筛选/搜索) + 创建草稿 + 详情/存新版本送审 + 审核流(submit/approve/request_changes/publish/archive)
- 教学管理 API: DELETE 班级(级联清空) + DELETE 学生(连带删提交) + DELETE 作业
- results.js 增强: 返回 questions(含标准答案) + 每生逐题明细
- UI: admin-homework.js 加删除班级/复制邀请码/移除学生/删除作业/逐题成绩
- admin-questions.js: 题型改 4 选项下拉 + 可折叠出题指南 + 预览学生视角

### 第七阶段：教师门户独立 (8月20日 00:30)

**commit 6ad2bf4**:
- auth.js 修复：登录对话框取消按钮加 formnovalidate，修复点击取消触发密码 required 校验
- 新建 teacher.html/teacher.js：独立教师门户，自带登录(角色校验)、仪表盘、tab 切换
- 架构：学生端 index.html / 教师端 teacher.html / 平台管理 admin.html，三者共享 mb_sid Cookie + D1
- teacher.js 通过 window.CONTENT_MANAGER 驱动复用 admin-questions.js 和 admin-homework.js
- 线上验证通过

### 第八阶段：音乐编辑器 (8月20日 11:50)

**commit 9e0348c**:
- 新增 admin-music-editor.js (~700行自包含模块)
- 模拟钢琴键盘(C3-C6) + Web MIDI API + 电脑键盘弹奏 + 五线谱SVG实时渲染
- 调号/节拍/时值/和弦模式/撤销重做/休止符/逐音符编辑
- 播放复用 piano-sampler.js 的 HetianPiano (Salamander 钢琴采样)
- admin-questions.js: 听写科目自动挂载编辑器
- teacher.html: 按序加载 piano-sampler.js → admin-music-editor.js → teacher.js
- 踩坑：JS 对象字面量键 `1/3` 是除法表达式，必须 `[1/3]` 计算属性名

---

## 十、给接手 AI 的说明

1. **项目已在 GitHub**：`git clone https://github.com/ht3045027170-sudo/educationmusicbox.git`
2. **本地路径**：`G:\和田玉音乐工具箱项目\和田玉音乐教育工具箱-内测0.0.1`
3. **部署方式**：push 到 GitHub main 分支 → Cloudflare Pages 自动构建部署
4. **数据库**：Cloudflare D1，需在 Cloudflare Dashboard 查看绑定
5. **环境变量**：SMTP_EMAIL, SMTP_PASSWORD (邮件发送)，D1 绑定名 DB
6. **测试方式**：
   - 学生端：https://educationmusicbox.pages.dev/
   - 教师端：https://educationmusicbox.pages.dev/teacher.html
   - 教师: 3045027170@qq.com
7. **下一步重点**：
   - 学生端答题界面适配音乐编辑器（目前只有教师出题端有编辑器）
   - OMR 识别服务实现
   - Service Worker 离线功能
   - admin API 完善 (login-logs/banned-ips/memberships)

---

## 十一、固定迭代与版本保留规则

1. 每次功能或界面修改都必须同步更新网站版与 Windows 软件版，不能只改其中一个。
2. 网站源码完成检查后推送 GitHub，并确认 Cloudflare Pages 已部署到线上。
3. Windows 版使用同一批已确认的网页源码重新打包；涉及识谱时必须保留完整本地 OMR 引擎、模型、Python 运行环境和许可证。
4. 每次迭代完成并验证新版本可启动后，只保留“当前版本”和“上一版本”作为备用。
5. 删除“上上个版本”前，必须先核对其绝对路径和版本号，且不得删除尚未验证的新版本或唯一可用备份。

### 2026-09-02：训练题库管理 Sprint 1

- 将教师端统一为“教师工作台”，首页增加“训练题库管理”入口。
- 题库分为“乐理训练 / 听记训练 / 套题管理”，支持难度、状态与关键词筛选。
- 列表直接显示每题难度、作答限时、听记播放次数、版本和更新时间。
- `admin` 定义为“总管理员教师”，可管理全部训练题库；普通教师可浏览全库，但只能修改自己创建的题目。
- `admin` 同时具备教师中心、班级与作业相关教师权限，不再被学生入口误判。
- 后续 Sprint 2：软删除与回收站、批量修改、题目时限快捷编辑、套题总时限和发布状态统一管理。
- 修正题源遗漏：新增幂等同步接口，将乐理内置题、原创扩充题及广东艺考听记题共 462 道同步进 D1；套题编辑器可直接引用这些已发布题目组卷。
