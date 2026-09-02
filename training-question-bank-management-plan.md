# Plan: 训练题库统一管理

**Generated**: 2026-09-02  
**Estimated Complexity**: Medium

## Overview

在现有海棠艺考教师工作台中增加“训练题库管理”，复用现有题目编辑器、D1 题目接口和套题接口，统一管理乐理、听记与套题。正式数据以云端数据库为准，Windows 版使用同一网页代码并保留离线缓存。第一阶段不重构全部题库，只建立可靠的管理入口与编辑闭环。

## Prerequisites

- 继续使用原生 HTML/CSS/JavaScript、Cloudflare Pages Functions 与 D1。
- 教师登录与 CSRF 校验继续复用现有接口。
- 题目修改、删除和发布时间设置必须由服务端验证权限。
- 已确认默认规则：回收站删除、草稿后发布、支持批量修改、普通教师只能修改自己的题目、套题按分钟而单题按秒。
- 当前 `admin` 账号定义为“总管理员教师”，从教师工作台直接管理全部题库；不再单独设计另一套总题库后台。

## Sprint 1: 统一题库管理入口

**Goal**: 教师可以在一个页面查看、筛选并进入编辑所有获授权的乐理、听记和套题。  
**Demo/Validation**:

- 教师主页显示“训练题库管理”。
- 乐理、听记、套题三个标签可以切换。
- 搜索、科目、题型、难度、状态筛选可用。
- 点击题目复用现有音乐试题编辑器。

### Task 1.1: 增加管理入口与标签

- **Location**: `teacher-workbench.js`
- **Description**: 在已有教师工作台中加入训练题库管理视图，不新建第二套后台。
- **Dependencies**: 无。
- **Acceptance Criteria**:
  - 乐理、听记、套题入口清楚可见。
  - 移动端仍可操作。
- **Validation**: 教师账号进入工作台并切换三个标签。

### Task 1.2: 扩展题目筛选与列表信息

- **Location**: `teacher-workbench.js`, `functions/api/admin/questions/index.js`
- **Description**: 增加题型、难度、来源和状态筛选；列表显示默认作答时间、播放次数、更新时间和所属套题提示。
- **Dependencies**: Task 1.1。
- **Acceptance Criteria**:
  - 多条件组合筛选结果正确。
  - 空字段使用安全默认值，不导致旧题报错。
- **Validation**: 使用乐理、听记、草稿和已发布题目分别筛选。

### Task 1.3: 接入套题列表

- **Location**: `teacher-workbench.js`, `functions/api/teaching/[system]/sets.js`
- **Description**: 在相同管理视图读取现有套题，显示题量、总分、总限时和状态。
- **Dependencies**: Task 1.1。
- **Acceptance Criteria**:
  - 套题总限时以分钟显示。
  - 不把“从套题移除”当成“删除题目”。
- **Validation**: 创建一份草稿套题并重新打开。

## Sprint 2: 安全编辑、时间与回收站

**Goal**: 题目和套题可以安全修改、停用、恢复，并保留历史作答可靠性。  
**Demo/Validation**:

- 单题默认限时可修改。
- 套题总限时可修改。
- 题目可以停用、移入回收站并恢复。
- 已发布题目修改后先成为草稿，不直接改变学生正在做的内容。

### Task 2.1: 固化总管理员教师权限

- **Location**: `functions/api/shared.js`, 题库 API。
- **Description**: 复用现有 `admin` 服务端角色作为总管理员教师；普通教师仍只能编辑自己的题目。
- **Dependencies**: Sprint 1。
- **Acceptance Criteria**:
  - 权限不能由浏览器本地伪造。
  - 未授权教师编辑他人题目返回 403。
- **Validation**: 分别使用负责人和普通教师账号调用编辑接口。

### Task 2.2: 统一题目时间字段

- **Location**: `teacher-workbench.js`, 题目 API。
- **Description**: 继续兼容现有 `content.studentSettings.timeLimit`，界面统一称为“单题默认限时（秒）”。
- **Dependencies**: Sprint 1。
- **Acceptance Criteria**:
  - 旧题可读取，新题可保存。
  - 修改单题默认时间不改变套题总限时。
- **Validation**: 修改后重新读取题目并核对值。

### Task 2.3: 停用、回收站与恢复

- **Location**: `functions/api/admin/questions/[id].js`, `teacher-workbench.js`
- **Description**: 使用 `archived` 作为停用/回收状态，先不增加永久删除；历史成绩继续引用原题快照。
- **Dependencies**: Task 2.1。
- **Acceptance Criteria**:
  - 停用题不再进入学生随机训练。
  - 回收站题目可恢复。
- **Validation**: 停用、筛选回收站、恢复并重新发布。

### Task 2.4: 套题编辑与限时

- **Location**: `functions/api/teaching/[system]/sets/[id].js`, `teacher-workbench.js`
- **Description**: 编辑名称、题目顺序、每题分值、总限时和状态。
- **Dependencies**: Task 1.3。
- **Acceptance Criteria**:
  - 总限时范围校验。
  - 跨系统题目不能加入套题。
- **Validation**: 保存后重新加载并核对顺序、总分和时间。

## Sprint 3: 题库质量检查与批量修订

**Goal**: 能系统性找出并修复不合理题目，而不是逐页碰运气。  
**Demo/Validation**:

- 显示缺答案、重复选项、缺知识点、音程或和弦数据不一致等问题。
- 可批量修改难度、默认时间和状态。
- 每次批量操作显示影响题数并二次确认。

### Task 3.1: 复用现有质量检查模块

- **Location**: `quality/question-quality.js`, `teacher-workbench.js`
- **Description**: 把已有题目质量检查结果显示在管理列表中，不另写重复规则。
- **Dependencies**: Sprint 2。
- **Acceptance Criteria**: 错误题可以按问题类型筛选。
- **Validation**: 用一条故意缺答案的草稿确认能被识别。

### Task 3.2: 音乐数据一致性检查

- **Location**: `quality/question-quality.js`, `admin-music-editor.js`
- **Description**: 检查谱面 MIDI、正确答案、音程半音数、和弦组成音、拍号与小节时值。
- **Dependencies**: Task 3.1。
- **Acceptance Criteria**: 检查失败只阻止发布，不阻止保存草稿。
- **Validation**: 为每类错误保留一个最小自检样例。

### Task 3.3: 批量修改

- **Location**: 题库 API, `teacher-workbench.js`
- **Description**: 支持批量修改难度、默认时间和启用状态；不做批量改答案。
- **Dependencies**: Task 2.1。
- **Acceptance Criteria**: 服务端逐项验证权限，返回成功与失败数量。
- **Validation**: 混合本人题目和无权限题目进行批量操作。

## Sprint 4: 统一静态题库与发布

**Goal**: 教师修改能够真正影响网站和 Windows 学生训练，不再存在数据库与静态 JSON/JS 两套互不相干的正式题库。  
**Demo/Validation**:

- 完成现有题库来源清单与去重报告。
- 审核后的静态题目可导入 D1。
- 网站和 Windows 读取同一正式题库；Windows 离线时读取最后缓存。

### Task 4.1: 盘点并导入旧题库

- **Location**: `gaokao_system/database/`, `education/question-bank.js`, `music_theory_database/`
- **Description**: 为现有题目生成稳定 ID，去重后以草稿形式导入，不自动发布。
- **Dependencies**: Sprint 3。
- **Acceptance Criteria**: 原始文件保留，导入可重复执行且不会生成重复题。
- **Validation**: 对比导入前后分类数量与重复数。

### Task 4.2: 学生端读取正式题库

- **Location**: `index.html`, `gaokao_system/`, 学习 API。
- **Description**: 学生端优先读取已发布数据库题目，离线时读取最近缓存。
- **Dependencies**: Task 4.1。
- **Acceptance Criteria**: 草稿、回收站题目不会被学生抽到。
- **Validation**: 在线、断网和重新联网三种状态分别测试。

### Task 4.3: 同步发布两个载体

- **Location**: GitHub/Cloudflare Pages, `desktop-build/`
- **Description**: 推送网站并重新打包海棠音乐和海棠艺考 Windows 版；确认后仅保留当前版与上一版。
- **Dependencies**: 每个可发布 Sprint。
- **Acceptance Criteria**: 网站和 Windows 使用同一版本号与题库接口。
- **Validation**: 登录、题库管理、学生抽题、本地识谱启动检查。

## Testing Strategy

- API：教师身份、CSRF、所有权、负责人权限、输入范围。
- UI：桌面端与手机端筛选、编辑、回收站和套题操作。
- 数据：旧题兼容、发布状态、历史作答快照、离线缓存。
- 音乐：谱面与声音一致，音程/和弦/节奏规则检查。
- 发布：Cloudflare 页面和两个 Windows 包使用同一批源码。

## Potential Risks & Gotchas

- 当前 `/api/admin/questions` 名称仍沿用旧管理员架构，但实际已允许教师；第一阶段先复用，避免大范围改路由。
- 现有教师列表接口会看到所有题目，但普通教师编辑他人题目会被拒绝；UI 必须明确只读状态。
- `question_sets.sections_json` 当前只保存题号与分值，单题覆盖时间需要后续兼容字段，不能破坏旧套题。
- 静态题库与 D1 并存是最大数据风险，必须在 Sprint 4 前保持来源标识。
- 已发布题目的历史作答需要保存快照，否则修改答案会污染旧成绩。

## Rollback Plan

- 每个 Sprint 单独提交，可独立回退。
- 新字段保持可选，旧题和旧套题继续读取。
- 新管理入口出错时可隐藏入口，原教师出题工作台仍可使用。
- 发布新版本验证完成前不删除上一版；验证完成后才删除上上个版本。
