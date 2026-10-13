"""Maintain the agreed planning template, preserving edits to existing records."""
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import server

ROOT = Path(__file__).resolve().parent.parent
PLAN_PATH = ROOT / 'tools/personal-plan.json'
old_plan = json.loads(PLAN_PATH.read_text()) if PLAN_PATH.exists() else {}
NOTE = '建议行动；完成状态、实际成绩和具体截止日期需按你的情况更新。'
GOALS = [
 ('us-phd','美国申博 · 2026 申请 / 2027 入学','美国申博','当前目标：2026 年申请，2027 年入学。核心方向：扎实学习技术，在 AI 的一个方向形成研究能力；优先探索医学图像分析、MRI/CT 重建、医疗多模态 AI。可检索 CS、ECE、生物医学工程、医学信息学的相关导师。院校、导师及官方截止日期待核实。\n备选路线：研究助理或有论文与导师指导的研究型硕士；若本轮研究证据不足，评估 2028 年入学。备选不会替代当前目标。'),
 ('taiwan-study','台湾大学暑期深度研究 · 再次申请','台湾留学','此前未能参加，不能记为已完成科研或留学经历。计划再次申请暑期深度研究项目，结合当前 AI 兴趣匹配导师和课题。下一次项目年份、开放时间、资格、费用与具体研究组待官方核实。'),
 ('retake','课程重修申请','课程重修','已确认是课程重修申请。先确认可重修课程、申请流程与时间、成绩记录及 GPA 计算规则，并核实毕业和学位要求。当前成绩、课程清单及毕业时间待补充。'),
 ('ielts','雅思备考 · 目标 8.5','雅思','个人目标：总分 8.5。当前成绩、单项水平、目标考试日期待补充。院校最低要求与个人目标分开记录；不把 8.5 当作所有项目的录取要求。'),
 ('technical','Data Science / AI · 技术基础','技术与数据','先补微积分、线性代数、概率统计；继续学习回归、时间序列、优化。技能次序：Python → SQL → pandas / NumPy → EDA 与可视化 → scikit-learn / ML → PyTorch / 深度学习 / LLM。目标是独立完成数据清洗、EDA、建模、验证、可视化和商业解释。若明确走 Quant，再评估随机过程与金融工程数学。掌握程度待自评。'),
 ('research','医学影像 × AI · 研究证据','AI 科研','探索医学图像分析、MRI/CT 重建与医疗多模态 AI，选择一个小问题持续研究。读论文、复现基线、提出可检验的问题、开展对照实验、记录失败与局限。公开数据集分割与跨来源泛化可作为候选练习，须结合基础、数据许可和导师指导确认。现有科研成果与推荐人待补充。'),
 ('analytics','分析型硕士 · 项目比较与申请','研究生申请','准备 2026 年申请、2027 年入学，逐个核实官方截止日期和先修要求。优先比较 Business Analytics / Data Science / Analytics；数学编程准备充分且兴趣明确时比较 Financial Engineering / Quantitative Finance / FinTech；Finance 项目重点检查 Analytics、Programming、AI 与 Financial Modeling 课程。哥大 MSAA 作为你提过的候选项目记录，名称、课程、学制及要求待官网核实，不视为已申请或录取。'),
 ('finance','金融基础 · 财务与商业判断','金融学习','学习 Accounting、Corporate Finance、Economics、Investments：三张表、估值、DCF、NPV / IRR、资本结构、股票与债券。CFA 可作为学习框架，暂未设定考试或报名任务。目标是理解技术、数据、财务和商业模式，形成投资与创业判断。'),
 ('internship','职业桥梁 · Data / Finance 实习','职业实践','探索医疗 AI 公司、Healthcare VC、医药咨询、券商医药组、FinTech 和数据分析实习。优先积累可证明的数据或金融工作成果；行业和岗位为候选，不记为已有经历。长期方向：FinTech / 投资 / 创业。'),
 ('portfolio','可展示的数据与商业分析项目','项目作品','完成一个数据清洗 → EDA → 建模 → 验证 → 可视化 → 商业解释的项目，展示可运行代码、数据说明、评估结果与局限。结合医疗数据背景建立差异化，再探索金融或商业数据应用。数据权限、资源与具体选题待确认。'),
]
plan={'goals':[],'tasks':[],'opportunities':[],'profile':{
 'name':'','headline':'Medical Imaging × Data Science × AI → FinTech / 投资 / 创业',
 'summary':'长期主线：医学 / 医疗数据 → Data Science / AI → Finance → FinTech / 投资 / 创业，培养技术理解、金融判断与商业决策能力。2026 年申请、2027 年入学；本科毕业规划为 2027 年，具体月份待确认。并行比较分析型硕士、金融科技相关硕士与美国直博路线。雅思个人目标 8.5。保留 RA、研究型硕士及 2028 年入学备选，按准备进度再判断。',
 'industry':'','academic':'医学影像技术背景（据你提供的既往规划）。台湾大学暑期深度研究项目此前未能参加，准备结合 AI 方向再次申请。当前均分 / GPA、重修课程与毕业时间待补充。',
 'skills':'学习计划：数学与统计、Python / SQL / pandas / NumPy / scikit-learn、数据可视化与机器学习；之后学习 PyTorch / 深度学习。金融基础覆盖财务报表、公司金融、经济学、投资与估值。当前掌握程度待自评。',
 'volunteering':'','linkedin':'','cv':''}}
for slug,title,category,notes in GOALS:
 plan['goals'].append({'id':'plan-'+slug,'title':title,'category':category,'notes':notes,'progress':0,'start':'','due':''})
ACTIONS={
 'us-phd':[('核实 2027 入学项目的本轮官方截止日期','high'),('筛选匹配医学影像 AI 的项目与导师','high'),('梳理 CV、研究经历与推荐人准备事项','high'),('评估本轮直博准备度与 RA / 研究型硕士备选','high'),('准备研究兴趣说明与申请材料清单','medium')],
 'taiwan-study':[('核实暑期深度研究项目下一轮开放与资格','high'),('寻找 AI 或医学影像 AI 相关研究组','medium'),('准备再次申请的动机与研究兴趣说明','medium')],
 'retake':[('整理需要重修的课程与当前成绩','high'),('核实学校重修申请流程与成绩计算规则','high'),('确认重修安排对毕业和学位授予的影响','high')],
 'ielts':[('制定雅思 8.5 目标与单项提升计划','high'),('完成一次听说读写水平诊断','medium'),('制定每周练习安排','medium'),('确认考试时间、报名与成绩送达安排','medium')],
 'technical':[('自评数学与 Python 基础，安排补强次序','high'),('制定线代、概率与编程学习计划','medium'),('完成一个可复现的 Python / 机器学习练习','medium')],
 'research':[('选定医学影像 AI 的一个候选研究问题','high'),('阅读关键论文并复现一个公开基线','medium'),('整理导师资源与可指导研究的团队','medium'),('设计对照实验，记录结果与局限','medium'),('持续记录个人贡献，为推荐信提供具体证据','medium')],
 'analytics':[('比较 Analytics / Data Science / 金融科技项目及先修要求','high'),('核实各候选项目 GMAT / GRE、语言与成绩要求','high'),('核实哥大 MSAA 项目名称、课程与官方申请信息','medium'),('围绕医疗数据到 AI / Analytics 的迁移整理申请故事','medium')],
 'finance':[('学习三张财务报表与公司金融基础','medium'),('完成一次估值与 DCF / NPV / IRR 练习','medium'),('用真实公司材料练习商业模式与投资判断','medium')],
 'internship':[('整理 Data / Finance 相关实习候选岗位','high'),('制作突出医疗数据、AI 与分析能力的简历','medium'),('准备项目展示后联系或申请相关团队','medium')],
 'portfolio':[('选择一个可获取且有使用许可的数据集','medium'),('完成清洗、EDA、模型评估与可视化','medium'),('整理代码、复现说明与商业解释','medium')],
}
for slug,entries in ACTIONS.items():
 category=next(g['category'] for g in plan['goals'] if g['id']=='plan-'+slug)
 for index,(title,priority) in enumerate(entries):
  plan['tasks'].append({'id':f'plan-task-{slug}-{index+1}','title':title,'category':category,'notes':NOTE,'due':'','priority':priority,'status':'todo','goal':'plan-'+slug})
with server.connect() as conn:
 for kind in ('goals','tasks','opportunities'):
  old_by_id={item['id']:item for item in old_plan.get(kind,[])}
  for item in plan[kind]:
   new=server.validate(kind,item)
   row=conn.execute('SELECT data FROM items WHERE id=? AND kind=?',(item['id'],kind)).fetchone()
   if row:
    existing=json.loads(row[0]);old=server.validate(kind,old_by_id[item['id']]) if item['id'] in old_by_id else {}
    for key,value in new.items():
     if key not in existing or (key in old and existing[key]==old[key]):
      existing[key]=value
    new=server.validate(kind,existing)
   conn.execute('INSERT OR REPLACE INTO items (id,kind,data) VALUES (?,?,?)',(item['id'],kind,json.dumps(new,ensure_ascii=False)))
 row=conn.execute("SELECT data FROM items WHERE kind='profile'").fetchone()
 new=server.validate('profile',plan['profile'])
 if row:
  existing=json.loads(row[0]);old=old_plan.get('profile',{})
  for key,value in new.items():
   if not existing.get(key) or existing.get(key)==old.get(key):existing[key]=value
  new=server.validate('profile',existing)
 conn.execute('INSERT OR REPLACE INTO items (id,kind,data) VALUES (?,?,?)',('personal-profile','profile',json.dumps(new,ensure_ascii=False)))
PLAN_PATH.write_text(json.dumps(plan,ensure_ascii=False,indent=2))
print(f"Prepared {len(plan['goals'])} goals and {len(plan['tasks'])} suggested actions; custom fields preserved.")
