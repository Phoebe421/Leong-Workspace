# 智能日历：第一阶段

## 运行

复用项目已有 HTML / CSS / JavaScript，无需 Next.js 或额外运行依赖。

- **Mac 本地文件**：解压 `exports/Leong-Workspace.zip`，用 Safari / Chrome 打开 `Leong-Workspace.html`，左侧点击“智能日历”。不要用系统文件预览或文本编辑器运行交互。
- **本地服务**：在项目根目录执行 `python3 server.py --host 127.0.0.1 --port 8000`，浏览器访问本机 8000 端口。日历仍保存在浏览器，不依赖服务端授权。
- **开发后更新单文件**：`python3 tools/export_standalone.py`，然后 `cp exports/Leong-Workspace.html index.html`。

## 已实现

日 / 周 / 月视图；今天与上一/下一时段；新建、编辑、删除；开始和结束时间验证；学习、科研、职业、生活分类及自定义颜色；分类筛选；完成状态；跨日展示与重叠布局；浅/深色主题记忆；独立日历 JSON 导入/导出。

月视图把事件拖到日期上，保留开始时间与持续时长。日/周视图拖动事件右上角 ⠿，以15分钟吸附调整时间，保留时长；触屏也可用此把手，编辑表单始终提供等价操作。双击日/周空白时间格创建日程；月视图点击日期创建。重叠事件并排显示，此阶段不阻止冲突，也不推荐空闲时间。

日历模块使用设备本地时间与时区，在页面上显示时区名称。存储的起止时间是本地墙钟时间；尚未支持跨时区旅行的自动换算、重复事件或 Google/Apple 同步。时间区间采用左闭右开，午夜结束的事件不额外出现在第二天。夏令时不存在的本地时间会拒绝保存。

## 保存与兼容

日历使用独立 localStorage 键 `leong-calendar-v1`；主题使用 `leong-calendar-theme`。不改变已有 `leong-personal-workspace-v1` 数据或工作台备份格式。

请使用日历模块自己的“备份日历”按钮。工作台页脚的通用备份目前不包含日历，恢复工作台备份也不会改动日历。清除浏览器存储、换浏览器/设备或改变本地文件位置可能导致原有数据不可见；请先导出。损坏的日历原始数据不会自动删除；页面提示错误，导入有效日历备份是显式替换操作。

## 验证

```sh
python3 tools/export_standalone.py
node --check static/calendar.js
node tests/calendar.browser.cjs
python3 -m unittest discover -s tests -v
```

浏览器测试需要 Node.js + Playwright + Chromium（仅测试依赖）。若本机没有，可运行 `npm install --no-save --package-lock=false playwright` 和 `npx playwright install chromium`。项目已有依赖声明与锁文件不应因此改变。可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定本机 Chromium。

测试使用临时 HTTP 服务和隔离浏览器上下文，覆盖三种视图、增删改、无效时间、刷新保留、月视图拖拽、15分钟时间拖动与时长保持、分类颜色、完成状态、主题记忆、重叠跨日布局、备份恢复、旧任务数据保留、手机布局及页面异常。

## 后续阶段

第二阶段：自然语言解析与待确认草稿。第三阶段：Google Calendar OAuth 和读写同步（实际授权前仍可本地使用）。第四阶段：优先级规划、冲突检测、空闲推荐与效率分析。第一阶段不调用 AI、不需要 OAuth，不请求用户提供密钥。Apple 集成的只读评估见 `apple-integration.md`。
