'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const labels = {high:'高优先级',medium:'中优先级',low:'低优先级',todo:'待开始',doing:'进行中',done:'已完成',interested:'待了解',applied:'已申请',interview:'面试中',offer:'已获得',closed:'已结束'};
let state = {tasks:[],goals:[],opportunities:[],thoughts:[],inspirations:[],profile:{}};
let loaded = false;
let newsState = null, newsFilter = 'all', newsBusy = false;
let filters = {status:'all',search:'',priority:'all',period:'all'};
let ideaTab='thoughts', ideaSearch='';
let editing = null, pendingDelete = null, toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
async function api(path, method='GET', data) {
  if(window.offlineAPI)return window.offlineAPI(path,method,data);
  const response = await fetch(path, {method, headers:data ? {'Content-Type':'application/json'} : {}, body:data ? JSON.stringify(data) : undefined});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '保存失败，请重试');
  return result;
}
async function refresh() { state=await api('/api/state'); loaded=true; render(); }
function page() { const hash=location.hash.slice(1); return ['overview','career','tasks','news','ideas','calendar'].includes(hash) ? hash : 'overview'; }
function heading(label, title, subtitle, kind, button) { return `<div class="page-heading"><div><div class="eyebrow">${label}</div><h1>${title}</h1><p>${subtitle}</p></div><button class="button" data-new="${kind}">＋ ${button}</button></div>`; }
function empty(symbol,title,detail,kind,button) { return `<div class="empty"><span class="empty-symbol">${symbol}</span>${title}<p>${detail}</p>${kind ? `<button class="button secondary" data-new="${kind}">＋ ${button}</button>`:''}</div>`; }
function dueText(item) { return item.due ? `<span class="${item.due < today() && item.status !== 'done' ? 'overdue':''}">${item.due < today() && item.status !== 'done' ? '已逾期 · ':''}${esc(item.due)}</span>` : ''; }
function taskRow(task, full=false) { const goal=state.goals.find(g=>g.id===task.goal); return `<div class="task-row ${task.status==='done'?'completed':''}"><button class="check ${task.status==='done'?'done':''}" data-toggle="${task.id}" aria-label="${task.status==='done'?'恢复任务':'完成任务'}：${esc(task.title)}">${task.status==='done'?'✓':''}</button><div class="task-text"><div class="task-title">${esc(task.title)}</div><div class="task-meta">${task.category?`<span>${esc(task.category)}</span>`:''}${dueText(task)}${goal?`<span>↗ ${esc(goal.title)}</span>`:''}</div></div><span class="priority ${task.priority}">${labels[task.priority]}</span>${full?`<span class="status-tag">${labels[task.status]}</span><div class="row-actions"><button class="icon-button edit-action" data-edit="tasks:${task.id}" aria-label="编辑任务 ${esc(task.title)}">编辑</button><button class="icon-button" data-delete="tasks:${task.id}" aria-label="删除任务 ${esc(task.title)}">×</button></div>`:''}</div>`; }
function goalMini(goal) { return `<div class="goal-mini"><div class="goal-title"><span>${esc(goal.title)}</span><span>${goal.progress}%</span></div><div class="progress" role="progressbar" aria-label="${esc(goal.title)}" aria-valuenow="${goal.progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${goal.progress}%"></span></div><div class="goal-meta">${esc(goal.category || '职业目标')}${goal.due?' · '+esc(goal.due):''}</div></div>`; }
function sortedTasks(tasks) { const rank={high:0,medium:1,low:2}; return [...tasks].sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999') || rank[a.priority]-rank[b.priority]); }
function overview() {
 const pending=state.tasks.filter(t=>t.status!=='done');
 const focus=sortedTasks(pending).slice(0,4);
 const completed=state.tasks.filter(t=>t.status==='done').length;
 const active=state.goals.filter(g=>g.progress<100);
 const opportunities=state.opportunities.filter(o=>o.stage!=='closed');
 const stats=[['待办任务',pending.length,'把想法变成下一步行动','▣'],['已完成',completed,'每一步都值得被记录','✓'],['进行中的目标',active.length,'朝着想去的方向前进','↗'],['跟进中的机会',opportunities.length,'为新的可能保留空间','✧']];
 return heading('YOUR PERSONAL SPACE','你好，今天也向前一步。','这里是你的个人工作台，把目标、计划和行动放在一起。','tasks','新增任务')+
 `<section class="hero"><div><div class="eyebrow">A LITTLE PROGRESS, EVERY DAY</div><h2>按自己的节奏，走向想要的生活。</h2><p>不必一次完成所有事，先做好眼前的一小步。</p></div><div class="hero-art" aria-hidden="true"><span class="orbit"></span><span class="orbit second"></span><span class="star">✦</span><span class="little-star">✧</span></div></section>`+
 `${timelineSection()}<section class="stats" aria-label="工作台概况">${stats.map(s=>`<div class="stat"><div class="stat-label">${s[0]}<span class="stat-icon">${s[3]}</span></div><div class="stat-number">${s[1]}</div><small>${s[2]}</small></div>`).join('')}</section>`+
 `<div class="dashboard-grid"><section class="panel"><div class="panel-heading"><h2>近期重点<span>Focus & priorities</span></h2><a class="text-link" href="#tasks">全部任务 ↗</a></div>${focus.length?focus.map(t=>taskRow(t)).join(''):empty('▣','给今天一个小小的开始','添加一项任务，安排下一步行动。','tasks','添加任务')}</section><section class="panel"><div class="panel-heading"><h2>职业目标<span>Your direction</span></h2><a class="text-link" href="#career">查看 Career ↗</a></div>${active.length?active.slice(0,3).map(goalMini).join(''):empty('↗','下一站，你想去哪里？','记录一个目标，让努力有方向。','goals','创建目标')}</section></div>${distributionSection()}<section class="panel briefing"><div class="panel-heading"><h2>每日情报<span>AI & Economy</span></h2><a class="text-link" href="#news">查看全部 ↗</a></div>${newsContent(3)}</section><div class="week-note"><span>✦</span>留一点时间给重要的事，也留一点空间给自己。<small>ONE STEP AT A TIME</small></div>`;
}
function goalCard(goal) {
 const tasks=state.tasks.filter(t=>t.goal===goal.id), done=tasks.filter(t=>t.status==='done').length;
 return `<article class="goal-card"><div class="goal-category">${esc(goal.category||'职业发展')}</div><div class="goal-title"><span>${esc(goal.title)}</span><span>${goal.progress}%</span></div><p>${esc(goal.notes||'为这个目标添加方向和计划。')}</p><div class="progress" role="progressbar" aria-label="${esc(goal.title)}" aria-valuenow="${goal.progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${goal.progress}%"></span></div><div class="goal-meta">手动记录目标进度${goal.due?' · 目标日期 '+esc(goal.due):''}</div><div class="goal-footer"><span>阶段计划 · ${done}/${tasks.length} 已完成</span><button class="text-link" data-plan="${goal.id}">＋ 添加计划</button></div>${tasks.slice(0,3).map(t=>taskRow(t)).join('')}${tasks.length>3?'<a class="text-link" href="#tasks">在 To-do List 查看所有计划 ↗</a>':''}<div class="row-actions"><button class="icon-button edit-action" data-edit="goals:${goal.id}">编辑目标</button><button class="icon-button" data-delete="goals:${goal.id}" aria-label="删除目标 ${esc(goal.title)}">×</button></div></article>`;
}
function opportunityCard(item) { return `<article class="goal-card"><div class="goal-category">${labels[item.stage]}</div><div class="goal-title"><span>${esc(item.title)}</span></div><p>${esc(item.notes||'添加机会信息与下一步跟进安排。')}</p><div class="goal-footer"><span>${esc(item.category||'未填写机构')}${item.due?' · 跟进 '+esc(item.due):''}</span></div><div class="row-actions"><button class="icon-button edit-action" data-edit="opportunities:${item.id}">更新进度</button><button class="icon-button" data-delete="opportunities:${item.id}" aria-label="删除机会 ${esc(item.title)}">×</button></div></article>`; }
function career() { return heading('BUILD YOUR NEXT CHAPTER','Career','明确方向，拆解阶段计划，记录每一个新的机会。','goals','创建目标')+
 profileSection()+`<div class="section-note">目标进度由你手动更新；关联的阶段计划会同步显示在 To-do List。</div><div class="panel-heading"><h2>职业目标与阶段计划</h2><span class="goal-meta">${state.goals.length} 个目标</span></div><section class="goals-grid">${state.goals.length?state.goals.map(goalCard).join(''):`<div class="panel wide-empty">${empty('↗','从一个目标开始','想提升的能力、想达成的里程碑，都可以写在这里。','goals','创建职业目标')}</div>`}</section><div class="panel-heading" style="margin-top:32px"><h2>机会进度<span>Keep possibilities open</span></h2><button class="button secondary" data-new="opportunities">＋ 记录机会</button></div><section class="goals-grid">${state.opportunities.length?state.opportunities.map(opportunityCard).join(''):`<div class="panel wide-empty">${empty('✧','记录下一个可能','管理工作机会、合作申请或其他值得跟进的机会。','opportunities','记录机会')}</div>`}</section>`; }
function filteredTasks() { return sortedTasks(state.tasks.filter(t=>matchesPeriod(t.due,filters.period)&&(filters.status==='all'||t.status===filters.status)&&(filters.priority==='all'||t.priority===filters.priority)&&`${t.title} ${t.notes} ${t.category}`.toLowerCase().includes(filters.search.toLowerCase()))); }
function tasksContent() { const tasks=filteredTasks(); return tasks.length?tasks.map(t=>taskRow(t,true)).join(''):empty('▣',state.tasks.length?'没有符合条件的任务':'把下一步写下来',state.tasks.length?'试试其他关键词或筛选条件。':'从一件小事开始，慢慢建立自己的节奏。',state.tasks.length?'':'tasks','添加第一项任务'); }
function tasksPage() { return heading('MAKE ROOM FOR WHAT MATTERS','To-do List','把事情记在这里，让头脑留给更重要的思考。','tasks','新增任务')+
 `<div class="period-tabs" aria-label="按目标日期查看">${[['all','全部'],['today','Today · 今天'],['week','Week · 本周'],['month','Month · 本月'],['unscheduled','未安排']].map(([key,text])=>`<button class="period-tab ${filters.period===key?'active':''}" data-period="${key}" aria-pressed="${filters.period===key}">${text}</button>`).join('')}</div><div class="section-note">按目标日期筛选；本周为周一至周日，未设置日期的任务在“未安排”中查看。</div><div class="toolbar"><input class="search" id="search" aria-label="搜索任务" placeholder="搜索任务、备注或分类…" value="${esc(filters.search)}"><select id="priority-filter" aria-label="按优先级筛选"><option value="all">全部优先级</option>${['high','medium','low'].map(p=>`<option value="${p}" ${filters.priority===p?'selected':''}>${labels[p]}</option>`).join('')}</select><div class="tabs" aria-label="按状态筛选">${['all','todo','doing','done'].map(s=>`<button class="tab ${filters.status===s?'active':''}" data-filter="${s}" aria-pressed="${filters.status===s}">${s==='all'?'全部任务':labels[s]}</button>`).join('')}</div></div><section class="panel task-list" id="task-results">${tasksContent()}</section>`; }
function render() { const p=page(); document.querySelectorAll('nav a,.news-nav').forEach(a=>{a.classList.toggle('active',a.dataset.page===p); if(a.dataset.page===p)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}); $('#breadcrumb').textContent={overview:'Overview',career:'Career',tasks:'To-do List',news:'每日情报',ideas:'思考与灵感',calendar:'智能日历'}[p]; if(state.profile?.name){$('.profile>div').firstChild.textContent=state.profile.name;} $('#task-count').textContent=state.tasks.filter(t=>t.status!=='done').length; $('#main').innerHTML=loaded?{overview,career,tasks:tasksPage,news:newsPage,ideas:ideasPage,calendar:Calendar.render}[p]():'<div class="empty">正在加载你的工作台…</div>'; }
function field(label,name,value='',type='text',extra='') { return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`; }
function select(label,name,values,value) { return `<label class="field">${label}<select name="${name}">${values.map(([key,text])=>`<option value="${esc(key)}" ${key===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`; }
function openEditor(kind,id='',goal='') {
 const item=id?state[kind].find(i=>i.id===id):{}; if(!item)return;
 editing={kind,id};
 $('#modal-title').textContent=`${id?'编辑':'新增'}${{tasks:'任务',goals:'职业目标',opportunities:'机会',thoughts:'零碎想法',inspirations:'灵感'}[kind]}`;
 let fields=field(kind==='tasks'?'任务标题':kind==='goals'?'目标名称':kind==='opportunities'?'机会名称':'标题','title',item.title,'text','required maxlength="200" placeholder="写下一个清晰的标题"');
 if(['thoughts','inspirations'].includes(kind)){fields+=field('标签 / 分类','category',item.category,'text','maxlength="100" placeholder="例如：AI、经济、生活"');if(item.created)fields+=`<input type="hidden" name="created" value="${esc(item.created)}">`;}
 else fields+='<div class="field-pair">'+field(kind==='opportunities'?'机构 / 公司':'分类','category',item.category,'text','maxlength="100" placeholder="可选"')+field(kind==='opportunities'?'下次跟进日期':'目标日期','due',item.due,'date')+'</div>';
 if(kind==='tasks') if(['thoughts','inspirations'].includes(kind)){fields+=field('标签 / 分类','category',item.category,'text','maxlength="100" placeholder="例如：AI、经济、生活"');if(item.created)fields+=`<input type="hidden" name="created" value="${esc(item.created)}">`;}
 else fields+='<div class="field-pair">'+select('优先级','priority',['high','medium','low'].map(p=>[p,labels[p]]),item.priority||'medium')+select('状态','status',['todo','doing','done'].map(s=>[s,labels[s]]),item.status||'todo')+'</div>'+select('关联职业目标','goal',[['','不关联目标'],...state.goals.map(g=>[g.id,g.title])],item.goal||goal);
 if(kind==='goals') fields+=field('开始日期（用于 Overview 时间进度）','start',item.start,'date')+field('进度（0–100%，手动更新）','progress',item.progress??0,'number','required min="0" max="100" step="1"');
 if(kind==='opportunities') fields+=select('当前阶段','stage',['interested','applied','interview','offer','closed'].map(s=>[s,labels[s]]),item.stage||'interested');
 fields+=`<label class="field">${['thoughts','inspirations'].includes(kind)?'内容':'备注 / 下一步'}<textarea name="notes" maxlength="5000" placeholder="补充细节、行动或想法…">${esc(item.notes||'')}</textarea></label>`;
 $('#fields').innerHTML=fields; $('#editor').showModal();
}
document.addEventListener('click',async event=>{
 const target=event.target.closest('[data-new],[data-edit],[data-delete],[data-toggle],[data-filter],[data-plan],[data-period],[data-profile]'); if(!target)return;
 if(target.hasAttribute('data-profile'))return openProfile();
 if(target.dataset.period){filters.period=target.dataset.period;render();return;}
 if(target.dataset.new) return openEditor(target.dataset.new);
 if(target.dataset.edit) {const [kind,id]=target.dataset.edit.split(':');return openEditor(kind,id);}
 if(target.dataset.plan)return openEditor('tasks','',target.dataset.plan);
 if(target.dataset.delete){const [kind,id]=target.dataset.delete.split(':');pendingDelete={kind,id};$('#confirm-dialog').showModal();return;}
 if(target.dataset.filter){filters.status=target.dataset.filter;render();return;}
 if(target.dataset.toggle){const task=state.tasks.find(t=>t.id===target.dataset.toggle);target.disabled=true;try{await api(`/api/tasks/${task.id}`,'PUT',{...task,status:task.status==='done'?'todo':'done'});await refresh();toast(task.status==='done'?'任务已恢复':'又完成了一步 ✓');}catch(error){toast(error.message);target.disabled=false;}}
});
document.addEventListener('input',event=>{if(event.target.id==='search'){filters.search=event.target.value;$('#task-results').innerHTML=tasksContent();}});
document.addEventListener('change',event=>{if(event.target.id==='priority-filter'){filters.priority=event.target.value;$('#task-results').innerHTML=tasksContent();}});
$('#edit-form').addEventListener('submit',async event=>{event.preventDefault(); const data=Object.fromEntries(new FormData(event.target));if(editing.kind==='goals')data.progress=Number(data.progress);$('#save-button').disabled=true;try{await api(`/api/${editing.kind}${editing.id?'/'+editing.id:''}`,editing.kind==='profile'||editing.id?'PUT':'POST',data);await refresh();$('#editor').close();toast('已保存到你的工作台');}catch(error){toast(error.message);}finally{$('#save-button').disabled=false;}});
$('#close-dialog').onclick=$('#cancel-dialog').onclick=()=>$('#editor').close();
$('#keep-item').onclick=()=>$('#confirm-dialog').close();
$('#delete-item').onclick=async()=>{if(!pendingDelete)return;$('#delete-item').disabled=true;try{await api(`/api/${pendingDelete.kind}/${pendingDelete.id}`,'DELETE');await refresh();$('#confirm-dialog').close();pendingDelete=null;toast('已删除');}catch(error){toast(error.message);}finally{$('#delete-item').disabled=false;}};
window.addEventListener('hashchange',render);
setInterval(loadNews,30*60*1000);
function updateClock(){ $('#today-label').textContent=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})+' · 上海时间'; }
updateClock();setInterval(updateClock,1000);
render();refresh().catch(()=>{$('#main').innerHTML='<div class="error-panel">暂时无法连接工作台。请确认服务正在运行，再刷新页面。</div>';});

function newsContent(limit=0) {
 if(window.LEONG_OFFLINE)return '<div class="source-warning">这是可直接打开的本地版本，尚未连接实时资讯服务。下方入口可直接查看原始来源。</div><div class="news-item"><a href="https://techcrunch.com/category/artificial-intelligence/" target="_blank" rel="noopener noreferrer">TechCrunch · AI 科技 ↗</a></div><div class="news-item"><a href="https://arxiv.org/list/cs.AI/recent" target="_blank" rel="noopener noreferrer">arXiv · AI 研究 ↗</a></div><div class="news-item"><a href="https://www.bbc.com/business" target="_blank" rel="noopener noreferrer">BBC · 经济与商业 ↗</a></div>';
 if(!newsState)return '<div class="news-loading">正在读取 AI 与经济资讯…</div>';
 let items=newsState.items.filter(i=>newsFilter==='all'||i.category===newsFilter);
 if(limit)items=items.slice(0,limit);
 const warning=newsState.errors.length?'<div class="source-warning">部分资讯源暂时无法读取'+(newsState.items.length?'，下面保留最近缓存的内容。':'。请在环境设置中允许资讯源域名，再重新启动服务。')+'</div>':'';
 const list=items.map(item=>{
   const published=item.published?new Date(item.published):null;
   const date=published?published.toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'来源未提供发布时间';
   const older=published&&Date.now()-published.getTime()>48*3600000;
   return `<article class="news-item"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ↗</a>${!limit&&item.summary?`<p>${esc(item.summary)}</p>`:''}<div class="news-meta"><span class="news-category">${item.category==='ai'?'AI 科技':'经济动态'}</span><span>${esc(item.source)}</span><span>${esc(date)}</span>${older?'<span>较早发布</span>':''}</div></article>`;
 }).join('');
 return warning+(items.length?list:empty('✧','暂时没有可用资讯','这里仅展示真实来源内容，连接恢复后会自动读取。','',''));
}
function newsPage() {
 const updated=newsState?.updated?new Date(newsState.updated).toLocaleString('zh-CN'):'尚未成功更新';
 return `<div class="page-heading"><div><div class="eyebrow">YOUR DAILY READING</div><h1>每日情报</h1><p>关注 AI 科技与经济动态，为自己的判断积累信息。</p></div>${window.LEONG_OFFLINE?'':`<button class="button secondary" id="refresh-news" ${newsBusy?'disabled':''}>${newsBusy?'更新中…':'↻ 检查更新'}</button>`}</div><div class="news-intro"><span>✧ AI 科技 · AI 研究 · 经济与商业</span><small>${window.LEONG_OFFLINE?'本地版 · 来源阅读入口':'最近成功读取：'+esc(updated)}</small></div>${window.LEONG_OFFLINE?'':`<div class="toolbar"><div class="tabs">${[['all','全部资讯'],['ai','AI 科技'],['economy','经济动态']].map(([key,text])=>`<button class="tab ${newsFilter===key?'active':''}" data-news-filter="${key}" aria-pressed="${newsFilter===key}">${text}</button>`).join('')}</div></div><div class="section-note">打开工作台时读取，每 30 分钟检查更新。按来源发布时间排序，保留原文标题与摘要，不进行 AI 编写或翻译。</div>`}<section class="panel">${newsContent()}</section>`;
}
async function loadNews() {
 if(newsBusy)return;
 newsBusy=true;
 try{newsState=await api('/api/news');}catch{newsState={items:newsState?.items||[],updated:newsState?.updated||null,errors:[{message:'连接失败'}]};}
 finally{newsBusy=false;if(['overview','news'].includes(page())&&loaded)render();}
}
document.addEventListener('click',event=>{const target=event.target.closest('[data-news-filter],#refresh-news');if(!target)return;if(target.dataset.newsFilter){newsFilter=target.dataset.newsFilter;render();}else{loadNews();render();}});
loadNews();

function matchesPeriod(due,period,reference=new Date()) {
 if(period==='all')return true;
 if(period==='unscheduled')return !due;
 if(!due)return false;
 const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 if(period==='today')return due===iso(reference);
 if(period==='month')return due.slice(0,7)===iso(reference).slice(0,7);
 const start=new Date(reference.getFullYear(),reference.getMonth(),reference.getDate());
 start.setDate(start.getDate()-((start.getDay()+6)%7));
 const end=new Date(start);end.setDate(end.getDate()+6);
 return due>=iso(start)&&due<=iso(end);
}
function profileSection() {
 const p=state.profile||{};
 const links=[['linkedin','LinkedIn ↗'],['cv','打开 CV ↗']].filter(([key])=>p[key]).map(([key,text])=>`<a class="button secondary" href="${esc(p[key])}" target="_blank" rel="noopener noreferrer">${text}</a>`).join('');
 const cards=[['industry','工作经历','INDUSTRY'],['academic','教育与研究','ACADEMIC'],['skills','技能','SKILLS'],['volunteering','志愿与其他经历','VOLUNTEERING']];
 return `<section class="panel career-profile"><div class="panel-heading"><div><div class="eyebrow">CAREER PROFILE</div><h2>${esc(p.name||'你的职业档案')}</h2></div><button class="button secondary" data-profile>编辑档案</button></div><p class="profile-headline">${esc(p.headline||'记录经历、能力和想要前往的方向。')}</p>${p.summary?`<p class="profile-summary">${esc(p.summary)}</p>`:''}<div class="profile-links">${links}${!p.cv?'<span class="goal-meta">可添加在线简历或作品集链接</span>':''}</div><div class="experience-grid">${cards.map(([key,title,english])=>`<article class="experience-card"><span>${english}</span><h3>${title}</h3><p>${esc(p[key]||'点击「编辑档案」添加内容。')}</p></article>`).join('')}</div></section>`;
}
function openProfile() {
 const p=state.profile||{};editing={kind:'profile',id:''};$('#modal-title').textContent='编辑职业档案';
 let fields=field('姓名 / 昵称','name',p.name,'text','maxlength="100"')+field('职业方向 / 一句话介绍','headline',p.headline,'text','maxlength="200" placeholder="例如：关注 AI 与经济的交叉领域"');
 for(const [name,label] of [['summary','个人简介'],['industry','工作经历'],['academic','教育与研究'],['skills','技能'],['volunteering','志愿与其他经历']])fields+=`<label class="field">${label}<textarea name="${name}" maxlength="5000">${esc(p[name]||'')}</textarea></label>`;
 fields+=field('LinkedIn 链接','linkedin',p.linkedin,'url','placeholder="https://…"')+field('在线简历 / 作品集链接','cv',p.cv,'url','placeholder="https://…"')+'<p class="goal-meta">填写可访问的网页链接；本机文件路径无法在云工作台中打开。</p>';
 $('#fields').innerHTML=fields;$('#editor').showModal();
}

function timelineSection() {
 const goals=state.goals.filter(g=>g.start&&g.due);
 if(!goals.length)return `<section class="timeline-grid"><div class="timeline-empty"><span>◷</span><div><strong>给长期目标一条时间线</strong><p>在 Career 中为目标填写开始与结束日期，Overview 就会显示时间进度。</p></div><a class="text-link" href="#career">设置目标 ↗</a></div></section>`;
 return `<section class="timeline-grid">${goals.slice(0,4).map(g=>{
  const from=new Date(g.start+'T00:00:00'),to=new Date(g.due+'T00:00:00'),now=new Date(today()+'T00:00:00');
  const days=Math.round((to-from)/86400000),passed=Math.max(0,Math.min(days,Math.round((now-from)/86400000)));
  const percent=days>0?Math.min(100,Math.max(0,((now-from)/(to-from))*100)):now>=to?100:0;
  const remaining=Math.max(0,Math.round((to-now)/86400000));
  return `<article class="panel timeline-card"><div class="goal-meta">${esc(g.start)} → ${esc(g.due)}</div><div class="timeline-title"><h2>${esc(g.title)}</h2><strong>${percent.toFixed(1)}<small>%</small></strong></div><div class="progress" role="progressbar" aria-label="${esc(g.title)}时间进度" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div><div class="timeline-caption"><span>${now<from?'尚未开始':`已过 ${passed} 天`}</span><span>距结束 ${remaining} 天</span></div><div class="goal-meta">时间进度 · 目标完成度 ${g.progress}%</div></article>`;
 }).join('')}</section>`;
}
function distributionSection() {
 const count=state.tasks.length, categories=new Map();
 for(const task of state.tasks){const category=task.category||'未分类';categories.set(category,(categories.get(category)||0)+1);}
 const colors=['#d9826d','#7caa80','#dbb957','#7d9cab','#cb9155','#a591ac'];
 let offset=0;
 const groups=[...categories].sort((a,b)=>b[1]-a[1]);
 const segments=groups.map(([,n],index)=>{const start=offset;offset+=n/count*100;return `${colors[index%colors.length]} ${start}% ${offset}%`;}).join(',');
 return `<section class="panel task-distribution"><div class="panel-heading"><h2>任务分布<span>Task distribution</span></h2><a class="text-link" href="#tasks">查看任务 ↗</a></div><div class="portfolio-distribution"><div class="donut" style="background:${count?'conic-gradient('+segments+')':'#e9e0ca'}" role="img" aria-label="共 ${count} 项任务，按分类分布"><div><strong>${count}</strong><small>全部任务</small></div></div><div class="distribution-legend">${groups.length?groups.map(([category,n],index)=>`<div><span class="legend-dot" style="background:${colors[index%colors.length]}"></span><span>${esc(category)}</span><strong>${n}</strong></div>`).join(''):'<p>添加任务后，分类分布会显示在这里。</p>'}</div></div><div class="distribution-grid">${['todo','doing','done'].map(status=>{const n=state.tasks.filter(t=>t.status===status).length;return `<div><div class="distribution-title"><span>${labels[status]}</span><strong>${n}</strong></div><div class="progress"><span style="width:${count?n/count*100:0}%"></span></div></div>`;}).join('')}</div></section>`;
}

function ideasList() {
 const items=(state[ideaTab]||[]).filter(item=>`${item.title} ${item.notes} ${item.category}`.toLowerCase().includes(ideaSearch.toLowerCase()));
 return items.length?items.map(item=>`<article class="idea-card"><div class="panel-heading"><span class="goal-category">${esc(item.category|| (ideaTab==='thoughts'?'随手记':'灵感'))}</span><span class="goal-meta">${item.created?esc(new Date(item.created).toLocaleDateString('zh-CN')):''}</span></div><h2>${esc(item.title)}</h2><p>${esc(item.notes||'还没有补充内容。')}</p><div class="row-actions"><button class="icon-button edit-action" data-edit="${ideaTab}:${item.id}">编辑</button><button class="icon-button" data-delete="${ideaTab}:${item.id}" aria-label="删除${esc(item.title)}">×</button></div></article>`).join(''):`<div class="panel wide-empty">${empty(ideaTab==='thoughts'?'✎':'✧',ideaSearch?'没有匹配的记录':ideaTab==='thoughts'?'给零碎的思考一个落脚点':'把闪现的灵感留住',ideaSearch?'试试其他关键词。':ideaTab==='thoughts'?'不必完整，不必有结论，先记下来。':'一个研究问题、一个新点子，或一个想试试的可能。',ideaSearch?'':ideaTab,ideaTab==='thoughts'?'记录想法':'记录灵感')}</div>`;
}
function ideasPage() {
 return heading('SPACE FOR YOUR MIND','思考与灵感','零碎想法与灵感分开收藏，不急着把每个念头变成任务。',ideaTab,ideaTab==='thoughts'?'记录想法':'记录灵感')+`<div class="toolbar"><div class="tabs"><button class="tab ${ideaTab==='thoughts'?'active':''}" data-idea-tab="thoughts" aria-pressed="${ideaTab==='thoughts'}">✎ 零碎想法 <span>${(state.thoughts||[]).length}</span></button><button class="tab ${ideaTab==='inspirations'?'active':''}" data-idea-tab="inspirations" aria-pressed="${ideaTab==='inspirations'}">✧ 灵感 <span>${(state.inspirations||[]).length}</span></button></div><input class="search" id="idea-search" aria-label="搜索当前记录" placeholder="搜索标题、内容或标签…" value="${esc(ideaSearch)}"></div><div class="section-note">${ideaTab==='thoughts'?'零碎想法：日常观察、未成形的思考、疑问和感受。':'灵感：新的研究问题、创意和突然想到的可能。'}</div><section class="ideas-grid" id="ideas-results">${ideasList()}</section>`;
}
document.addEventListener('click',event=>{const target=event.target.closest('[data-idea-tab]');if(target){ideaTab=target.dataset.ideaTab;ideaSearch='';render();}});
document.addEventListener('input',event=>{if(event.target.id==='idea-search'){ideaSearch=event.target.value;$('#ideas-results').innerHTML=ideasList();}});
