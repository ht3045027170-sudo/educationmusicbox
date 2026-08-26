# 2026-08-18 工作日志

## 和田玉音乐教育工具箱 - 内测0.0.1版本整理

- 源项目路径: `G:\和田玉音乐工具箱项目\和田玉音乐教育工具箱-v1.15.0-GitHub上传版`
- 输出路径: `C:\Users\le\WorkBuddy\2026-08-18-22-00-36\和田玉音乐教育工具箱-内测0.0.1`
- 修复: 4个index.html中"考试省份"下拉框的"何欣只允许在广东省"替换为完整省级行政区列表
- 清理: 去除了.bat脚本、.zip备份、educationmusicbox-*备份文件夹、cloud-omr-service(Docker)、offline-omr-engine(Python)等服务端组件
- 保留: 116个网页必需文件(9.7MB)，含functions/文件夹(Cloudflare Pages OMR API)
- 版本号: index.html标题、关于软件、视唱模块标记统一更新为"内测0.0.1"

## 代码审查 - 内测0.0.1
- 12类问题: P0(2项) P1(4项) P2(6项)
- 关键发现: 21处/api/调用无后端、index.html 380KB巨石文件、无Service Worker、117处innerHTML
- 优点: 零console.log、零eval、try-catch覆盖率高、无障碍基础好

## 部署策略建议
- 线上地址: https://educationmusicbox.pages.dev/ (Cloudflare Pages)
- 已有API: /api/omr/health (返回JSON, ready:false), /api/omr/recognize (POST)
- 未实现API: /api/csrf, /api/auth/*, /api/admin/*, /api/learning/*, /api/teaching/*
- admin.html已部署, 显示登录页但无后端支持
- 建议: 利用现有Cloudflare Pages Functions模式, 逐步实现auth/admin/homework API, 用D1/KV存储

## 22:51 - Cloudflare D1 数据库创建完成
- 用户已创建 D1 数据库: 音乐盒数据库
- 当前在 Console 页面, 下一步执行建表 SQL + 绑定到 Pages 项目

## 22:57 - Functions 首批 13 个文件已写入
- functions/api/_shared.js (106 行)
- functions/api/csrf.js
- functions/api/auth/{session,login,logout,register,verify-email,forgot-password,reset-password,resend-verification,systems}.js
- functions/api/auth/systems/[code]/profile.js (动态路由)
- 用户待执行: ALTER TABLE 加 password_salt + profiles_json

## 23:10 - 项目文件迁移至G盘
- 新位置: G://和田玉音乐工具箱项目//和田玉音乐教育工具箱-内测0.0.1 (128文件, 9.7MB)
- C盘工作区已清空(仅保留.workbuddy记忆)
- 代码审查报告已移至 G://和田玉音乐工具箱项目///n- 用户选方案A: 内测0.0.1作为线上版推GitHub
- git全局账号: ht3045027170-sudo

## 23:20 - GitHub推送完成,发现Pages为直传模式
- G盘新仓库已force push到 github.com/ht3045027170-sudo/educationmusicbox (128文件含13个Functions)
- gh CLI已登录 ht3045027170-sudo, git push走https+gh凭证(gh auth setup-git)
- 实测: push后线上4分钟无变化, /api/csrf仍404回退HTML → Pages项目是Direct Upload模式,未连Git
- 待办: 用户需在Cloudflare重建Pages项目连Git(直传项目无法直接转Git模式), 需重新绑定D1

## 23:40 - Pages重建后首次构建失败已修复
- 失败原因: functions/api/_shared.js 下划线开头文件被 Cloudflare Pages Functions 构建排除, 10个文件 import 解析失败
- 修复: 改名为 shared.js, 更新11个文件的import路径, 提交 9b45e9a 已推送
- 教训: Pages Functions 目录下 _ 开头文件不参与构建, 共享模块不能这样命名
- 当前: 线上522(新项目尚无成功部署), 待新构建完成后验证 /api/csrf
- 用户已把Pages项目连上GitHub(构建日志显示从仓库clone)

## 23:55 - 部署成功,进行收尾修复
- 25f4c87 修正import路径深度后部署成功: 首页200, /api/auth/session 200 返回 {user:null}
- 遗留: /api/csrf 500 (匿名会话 user_id=0 违反外键) → 已提交修复: user_id 改插 NULL
- 待用户在D1执行: 重建 sessions 表使 user_id 可空(SQLite 无法直接去掉 NOT NULL)

## 后端联调与安全加固（深夜续）
- 用户在 D1 Console 重建 sessions 表（user_id 改为可空 NULL），外键约束报错解决
- commit `d1b3353`: shared.js 新增 verifyCsrfRequest()，login/logout/register/forgot-password/resend-verification 五个 POST 接口强制校验 X-CSRF-Token 头
- verify-email / reset-password 为邮件 token 制（sessions 表存 verify: 前缀 + csrf='pending'），不做会话 CSRF 校验
- 线上验证通过: /api/csrf 返回令牌、无 CSRF 头被 403 拦截、带正确令牌走正常业务校验
- 项目实际路径: G:/和田玉音乐工具箱项目/和田玉音乐教育工具箱-内测0.0.1（仓库 github.com/ht3045027170-sudo/educationmusicbox）
- 下一步: 网页端走通 注册→邮件验证→登录→会话 全流程实测

## 作业系统后端（8月19日凌晨）
- commit `c2b1d8b`: 新增 10 个 Functions 文件，teaching（班级/学生/作业/成绩/题库）+ learning（作业列表/加入班级/详情/提交判分）
- 表结构设计: questions(id,system_code,subject,knowledge_id,question_type,difficulty,content JSON,status,version_no)、classes、class_students、homework_assignments(question_ids JSON)、homework_submissions(answers JSON,score,wrong_count)
- shared.js 新增 currentUser()/requireTeacher() 鉴权助手；未提交时作业详情隐藏答案防作弊；提交自动判分（trim+大小写不敏感比对）
- commit `f43dbe1`: 安全修复——register.js 原来允许自选 admin 角色，已强制 learner；teacher/admin 需 D1 手动授权
- 待用户执行: D1 控制台重建 4 张作业表 + 建 questions 表 + 6 道种子题的 SQL
- admin API（/api/admin/questions 等）尚未实现，是下一大块

## 作业系统部署验证（8月19日 00:20）
- commit `8da8876`: 修复 3 个 4 层深文件的 import 路径（students/[classId]assignments/results 需 4 个 ../）——已写批量校验脚本核验全部 OK
- 教训: functions/api 下第 N 层目录的文件需要 (N-1) 个 ../ 回到 api/；写完必须跑路径深度校验脚本
- E2E 通过: 注册→邮箱验证→登录→学生作业列表→加班级校验→权限隔离(learner 访问 teaching 得 403)
- 测试账号: e2e_student_01 / e2e-student-01@mytest.local（learner，已在 D1）
- 待办: 用户注册教师账号后执行 UPDATE users SET role='teacher' 授权；之后测教师建班→发作业→学生提交→成绩全链路

## 管理后台桥接（8月19日 00:35）
- commit `d3af620`: /api/admin/session 复用主站 mb_sid Cookie，teacher/admin 角色返回 manager(platform:false) → admin.html 自动进入教师中心（教师中心标签藏在 admin.html，依赖 CONTENT_MANAGER）
- 注意: admin.html 自带登录表单写死 platform:true 会走 loadLogs（admin API 未实现会 404），故教师应直接用主站登录后访问 /admin.html
- 教师账号: 3045027170@qq.com（用户已在 D1 升级角色）

## 作业系统 E2E 大联调通过（8月19日 00:40）
- 班级「123456」(gaokao系统, 邀请码 9FBA7B, 用户教师账号创建)
- 测试学生: e2e_student_01(提交格式错误得0分, 已记录)、e2e_student_02(正确格式 {"题id":"答案"} 得100分)
- 关键契约: submit 接口 answers 必须是 {question_id: answer} 对象, 前端 homework.js 一致; 我发数组导致0分是测试姿势问题, 非代码bug
- 已验证: 过期作业拦截、重复提交409、答案隐藏防作弊、多学生成绩表
- 遗留: 用户发的作业id=1(id=2)截止日期设成过去无法提交; admin API(login-logs/banned-ips/memberships/questions管理)未实现

## 教师端大升级（8月19日 00:55, commits 37acd2b + 969ed39）
- 题库 API: /api/admin/questions 列表(分页/筛选/搜索)/POST创建草稿, /[id] GET详情/PUT存新版本并送审, /[id]/review POST审核流(submit/approve/request_changes/publish/archive)
- 审核权限: admin 全部; teacher 仅对自己题目 submit/publish(内测期放宽, 正式版可收紧)
- 教学管理 API: DELETE classes/[classId](级联清空), DELETE classes/[classId]/students/[studentId](连带删本班提交), DELETE assignments/[id]
- results.js 增强: 返回 questions(含标准答案) + 每生逐题明细(detail[].given/ok)
- UI: admin-homework.js 加删除班级/复制邀请码/移除学生/删除作业/逐题成绩; admin-questions.js 题型改4选项下拉
- 出题规律: knowledge_id 格式 {subject}-{topic}-{nn}; 题型 single_choice/multi_choice(|分隔)/true_false(正确|错误)/text_input; 听写题填 audioScript
- 待用户执行 D1: ALTER questions ADD instrument/source_label/review_notes 3列
- 教训: 导入路径校验正则要用 from '([.]+/)+shared\.js' 而非 [.]+/ (只匹配一层)

## 教师门户独立 + 出题系统完善（8月20日 00:30）
- auth.js 修复: 登录对话框取消按钮加 formnovalidate，修复点击取消触发密码 required 校验的 bug
- 新建 teacher.html/teacher.js: 独立教师门户，自带登录(角色校验 teacher/admin)、仪表盘、tab 切换
- 架构: 学生端 index.html / 教师端 teacher.html / 平台管理 admin.html，三者共享 mb_sid Cookie + D1
- teacher.js 通过 window.CONTENT_MANAGER 驱动现有 admin-questions.js 和 admin-homework.js 模块复用
- 非教师角色登录后自动登出并提示无权限
- admin-questions.js 增强: 题库审题标签顶部添加可折叠出题指南(知识点ID格式/题型答案格式/听写脚本/审核流程/判分规则)
- 新增「预览学生视角」功能: 编辑器中实时预览题目呈现效果
- commit 6ad2bf4, 线上验证通过: teacher.html 200、teacher.js 200、角色校验正常、指南与预览已部署
- 教师入口 URL: https://educationmusicbox.pages.dev/teacher.html

## 教师端音乐编辑器（8月20日 11:50, commit 9e0348c）
- 新增 admin-music-editor.js（约700行自包含模块）: 模拟钢琴键盘(C3-C6) + Web MIDI API接入 + 电脑键盘弹奏(A-L白键/W-P黑键/空格播放) + 五线谱SVG实时渲染
- 调号支持: C/G/D/A/E/F/Bb/Eb（渲染升/降号于谱头, 音符级 accidental 状态机）
- 节拍: 4/4 3/4 2/4 3/8 6/8; 时值: 全/二分/四分/八分/十六分/三连音+附点; 和弦模式(多键同按)
- 播放复用 sight-singing/piano-sampler.js 的 HetianPiano (Salamander采样)
- admin-questions.js: 听写科目自动挂载编辑器; content 新增 notes/meter/bpm/keySignature/category 字段; 预览含五线谱+试听; 表单可滚动
- teacher.html: 按序加载 piano-sampler.js → admin-music-editor.js → teacher.js (defer)
- 线上验证: 三个文件全部200, teacher.html 脚本标签顺序正确
- 注意: signature 格式与 gaokao-dictation.js 判分完全兼容 (midi/dur/rest/bar)
- 踩坑: JS对象字面量键 1/3 是除法表达式, 必须 [1/3] 计算属性名

## 教师出题、班级群与套题系统重构（8月27日，未上传）
- 教师出题改为工作台：题型卡片、桌面三栏、手机页签、单音/音程/和弦专属参数、学生端实时预览、草稿/发布、快速生成草稿。
- 五线谱编辑器按音乐数据渲染，支持高低音谱号、动态小节宽度、自动换行、加线、符干方向、休止符、附点、连桁、多小节；钢琴恢复标准黑白键比例并支持横向滑动。
- 关闭/返回出题页时统一停止采样器和播放队列；异步采样加载完成后也会核对页面生命周期，避免退出后继续发声。
- 班级群升级为账号级协作：消息左右由服务端 user id 判断，支持回复、删除、复制、多置顶、公告、成员管理、关键词/成员/日期搜索、历史分页和服务端未读数。
- 学生作业中心支持按时间和状态分组、作业详情、提交、错题回看、重做次数与历史成绩；教师端支持软删除、完成统计、学生搜索和逐题明细。
- 新增 QuestionSet 套题：听音/听记/乐理/视唱分区、题目引用、分值、拖动排序、保存、重新编辑、发布班级作业和群聊作业卡片。
- 两轮验收完成：全部相关 JavaScript 语法检查与质量脚本通过；桌面 1280×800、手机 390×844 的真实浏览器检查通过。测试页唯一控制台提示为 favicon 404。
- 当前工作区保留未提交、未推送状态，等待确认后再上传。
