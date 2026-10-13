"""Build a self-contained desktop HTML application with browser-local data."""
from pathlib import Path
import zipfile
import json

root = Path(__file__).resolve().parent.parent
html = (root / 'static/index.html').read_text()
css = (root / 'static/style.css').read_text()
js = (root / 'static/app.js').read_text()
offline = (root / 'tools/offline.js').read_text()
initial = json.loads((root / 'tools/personal-plan.json').read_text()) if (root / 'tools/personal-plan.json').exists() else {'tasks': [], 'goals': [], 'opportunities': [], 'profile': {}}
offline = 'window.LEONG_INITIAL_STATE='+json.dumps(initial, ensure_ascii=False).replace('<', '\u003c')+';\n'+offline
html = html.replace('<link rel="stylesheet" href="/style.css">', '<style>'+css+'\n.backup-actions{display:flex;gap:14px}@media(max-width:760px){footer{flex-direction:column;gap:8px}}</style>')
html = html.replace('<script src="/app.js" defer></script>', '<script>'+offline+'</script><script>'+js+'</script>')
output = root / 'exports'
output.mkdir(exist_ok=True)
page = output / 'Leong-Workspace.html'
page.write_text(html)
instructions = output / '如何打开.txt'
instructions.write_text('在电脑上打开：\n1. 解压此压缩包。\n2. 双击 Leong-Workspace.html，用 Chrome 或 Edge 浏览器打开。\n无需安装 Python，无需运行命令。\n\n本地版本支持 Overview、Career、To-do List、零碎想法与灵感。\n数据保存在当前浏览器内，换电脑、换浏览器或清除浏览器数据不会同步。\n请通过页面底部“导出备份”定期保存 JSON 文件，可通过“导入备份”恢复。\n已加入美国申博、台湾大学留学、重修申请、雅思准备四条主线。已确认 2026 年申请、2027 年入学、课程重修、雅思目标 8.5；台湾暑期研究此前未参加，计划再次申请。另有 AI 基础与医学影像 AI 科研准备目标，共 23 项建议待办。实际进度、考试日期和申请截止时间需要补充。\n\n每日情报仅提供来源阅读入口。本地版不会自动抓取新闻；实时资讯需要云端服务联网与部署。\n手机微信、聊天附件或系统文件预览可能不执行网页脚本，请在电脑浏览器打开。\n')
with zipfile.ZipFile(output / 'Leong-Workspace.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.write(page, page.name)
    archive.write(instructions, instructions.name)
print(page)
