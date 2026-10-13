# Apple Calendar / Reminders：只读可行性检查

## 本次检查结论

当前 Codex 执行环境是 Linux，未提供 Mac 桌面操作工具；`sw_vers`、`osascript`、`shortcuts`、`swift` 均不可用。此结果只说明当前会话没有接入用户的 Mac，不说明用户的 Mac 不支持这些功能，也不证明 macOS 隐私权限被拒绝。当前没有读取真实日程或提醒事项，更没有进行任何写入。

## Mac 端只读验证

在 Mac 本地打开此项目，通过终端执行：

```sh
cd /你的实际路径/Leong-Workspace
osascript tools/check_apple_access.applescript
```

可先用系统“脚本编辑器”打开并阅读脚本，再点击运行。脚本只读取系统版本、日历数量和提醒事项列表数量，不读取或输出事件内容，也不创建、编辑、删除、完成或导入数据。可能启动 Calendar / Reminders，并出现 macOS 自动化授权提示；是否允许由用户决定。

检查“系统设置 → 隐私与安全性 → 自动化”，确认实际执行应用（例如终端、脚本编辑器或本地 Codex）能控制日历和提醒事项。权限属于实际发出 Apple Events 的应用，不能把终端的授权当成浏览器、Codex 或 EventKit helper 的授权。应用通常需要先发起请求才出现在权限列表。

- 错误 -1743：通常表示 Apple Events 自动化授权被拒绝，需要检查自动化权限。
- 其他错误：按完整错误信息诊断；不要统一当作“没有权限”。
- 返回 0 个日历或列表：证明命令执行完成，但不足以证明账号已同步或可以写入。
- 此检查不请求、测试或证明写权限，也不证明 EventKit 已授权。

不要读取或修改 TCC 数据库来推断/绕过权限，不使用 `tccutil reset` 清除现有授权。

## 方案比较

| 方案 | 可行用途 | 权限与限制 |
| --- | --- | --- |
| Codex 本地桌面能力 | 在有真实 Mac 本地工具的会话中检查应用、读取与协助操作 | 当前云会话未提供；是否可用需在实际本地会话确认 |
| AppleScript | 验证 Calendar / Reminders 的读取，后续创建和修改 | macOS 自动化授权；需验证各版本脚本词典和具体属性支持 |
| macOS Shortcuts | 用户手动运行“查找日历事件”“添加新事件”“添加提醒事项”流程 | 首次使用时系统授权；动作范围随系统版本而异；适合先人工确认再触发 |
| EventKit 本地 helper | 结构化读写 Calendar / Reminders，持久标识、增量刷新和同步 | 需原生 macOS helper、应用身份、用途说明和隐私授权；不是纯 HTML 接口 |
| ICS 文件 | 生成用户确认后可导入的事件文件 | 仅导入用途，不提供现有事件读取、提醒事项双向同步或后台代理 |

EventKit 在 macOS 14+ 应按需要使用 `requestFullAccessToEvents` / `requestWriteOnlyAccessToEvents` 与 `requestFullAccessToReminders` 等对应 API。读取现有日历需要完整事件读取授权，只有写入授权不够。应检查 `EKEventStore.authorizationStatus(for:)`，并提供相应 Calendar / Reminders 用途说明；沙盒应用还需配置适用的日历访问 entitlement。API、用途说明与最低版本以实际 Mac 和 Apple 当前文档核实，尚未在 Mac 编译或验证。

长期建议：现有本地网页 → 同源本地服务 → 有明确权限的 EventKit helper。网页本身不能直接运行 AppleScript 或调用 EventKit。接口应限制本机访问、验证来源与认证，避免任何网页都能操作私人日历。不把 Mac bridge 放到公共 Pages 上冒充直接访问。

## 后续实现边界

1. 先取得只读权限，选择日历和日期范围，显示现有事件。
2. 自然语言产生草稿：名称、日期、起止时间、时区、目标日历、提醒事项列表。
3. 用户确认草稿后才执行创建；修改/删除同样单独确认。
4. 提醒事项没有起止时间时，不自动变成日历事件。用户先确认时间块与映射规则。
5. 用稳定标识记录提醒事项到日历事件的映射，保证重复同步不重复创建；已完成、取消与手工编辑冲突要明确策略。
6. Apple Calendar 与 Reminders 是两个独立存储。提醒事项可在部分系统版本的日历中显示，不等于有一个可同步编辑的 Calendar event；必须在用户实际版本中验证。

当前未集成 Apple 写入，没有后台同步，也没有在用户设备上创建任何项目。
