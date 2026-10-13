'use strict';
window.LEONG_OFFLINE=true;
(() => {
 const key='leong-personal-workspace-v1';
 const empty=()=>({tasks:[],goals:[],opportunities:[],thoughts:[],inspirations:[],profile:{}});
 const allowedStatus=['todo','doing','done'];
 const allowedPriority=['high','medium','low'];
 const allowedStages=['interested','applied','interview','offer','closed'];
 const string=(v,max=5000)=>{if(typeof v!=='string'||v.length>max)throw Error('数据字段格式无效');return v;};
 const validUrl=v=>{string(v);if(!v)return v;const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('链接格式无效');return v;};
 function normalize(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('备份文件格式无效');
  const result=empty(), ids=new Set();
  for(const kind of ['tasks','goals','opportunities','thoughts','inspirations']) {
   if(['thoughts','inspirations'].includes(kind)&&raw[kind]===undefined)raw={...raw,[kind]:[]};
   if(!Array.isArray(raw[kind])||raw[kind].length>10000)throw Error('备份列表格式无效');
   result[kind]=raw[kind].map(item=>{
    if(!item||typeof item!=='object')throw Error('记录格式无效');
    const id=string(item.id,100);
    if(!/^[a-zA-Z0-9-]+$/.test(id)||ids.has(id))throw Error('记录 ID 无效');
    ids.add(id);
    const title=string(item.title,200).trim();if(!title)throw Error('标题不能为空');
    const output={id,title,notes:string(item.notes||''),category:string(item.category||''),due:string(item.due||'',10)};
    if(output.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(output.due)||!Number.isFinite(Date.parse(output.due))||new Date(output.due).toISOString().slice(0,10)!==output.due))throw Error('日期格式无效');
    if(kind==='tasks') {
     if(!allowedStatus.includes(item.status)||!allowedPriority.includes(item.priority))throw Error('任务状态无效');
     Object.assign(output,{status:item.status,priority:item.priority,goal:string(item.goal||'',100)});
    }else if(kind==='goals'){
     output.start=string(item.start||'',10);if(output.start&&(!/^\d{4}-\d{2}-\d{2}$/.test(output.start)||!Number.isFinite(Date.parse(output.start))||new Date(output.start).toISOString().slice(0,10)!==output.start))throw Error('开始日期格式无效');if(output.start&&output.due&&output.start>output.due)throw Error('结束日期不能早于开始日期');
     if(!Number.isInteger(item.progress)||item.progress<0||item.progress>100)throw Error('进度无效');output.progress=item.progress;
    }else if(kind==='opportunities'){if(!allowedStages.includes(item.stage))throw Error('机会阶段无效');output.stage=item.stage;}else{output.created=string(item.created||new Date().toISOString(),50);if(!Number.isFinite(Date.parse(output.created)))throw Error('记录时间无效');}
    return output;
   });
  }
  const goals=new Set(result.goals.map(g=>g.id));
  result.tasks.forEach(t=>{if(t.goal&&!goals.has(t.goal))t.goal='';});
  const p=raw.profile||{};
  for(const field of ['name','headline','summary','industry','academic','skills','volunteering','linkedin','cv'])result.profile[field]=string(p[field]||'');
  validUrl(result.profile.linkedin);validUrl(result.profile.cv);
  return result;
 }
 function read() {const raw=localStorage.getItem(key);return raw?normalize(JSON.parse(raw)):normalize(window.LEONG_INITIAL_STATE||empty());}
 function save(value){const checked=normalize(value);localStorage.setItem(key,JSON.stringify(checked));return checked;}
 window.offlineAPI=async(path,method,data)=>{
  if(path==='/api/news')return {items:[],updated:null,errors:[]};
  const current=read();
  if(path==='/api/state'&&method==='GET')return current;
  if(path==='/api/profile'&&method==='PUT'){current.profile=data;save(current);return data;}
  const [,prefix,kind,id]=path.split('/');
  if(prefix!=='api'||!['tasks','goals','opportunities','thoughts','inspirations'].includes(kind))throw Error('记录不存在');
  if(method==='POST'){
   const item={...data,id:crypto.randomUUID(),...(['thoughts','inspirations'].includes(kind)?{created:new Date().toISOString()}: {})};current[kind].unshift(item);save(current);return item;
  }
  const index=current[kind].findIndex(i=>i.id===id);if(index<0)throw Error('记录不存在');
  if(method==='PUT'){current[kind][index]={...data,id,...(['thoughts','inspirations'].includes(kind)?{created:current[kind][index].created}: {})};save(current);return current[kind][index];}
  if(method==='DELETE'){current[kind].splice(index,1);if(kind==='goals')current.tasks.forEach(t=>{if(t.goal===id)t.goal='';});save(current);return {id};}
  throw Error('操作无效');
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const footer=document.querySelector('footer');
  footer.innerHTML='<span>本地版 · 数据保存在当前浏览器，请定期备份。</span><div class="backup-actions"><button class="text-link" id="export-backup">导出备份</button><button class="text-link" id="import-backup">导入备份</button><input type="file" accept="application/json,.json" id="backup-file" hidden></div>';
  document.querySelector('#export-backup').onclick=()=>{
   try{const blob=new Blob([JSON.stringify({version:1,data:read()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Leong-workspace-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出，请妥善保存');}catch{toast('导出失败，请检查浏览器存储权限');}
  };
  document.querySelector('#import-backup').onclick=()=>document.querySelector('#backup-file').click();
  document.querySelector('#backup-file').onchange=async event=>{
   const file=event.target.files[0];if(!file)return;
   try{
    if(file.size>10_000_000)throw Error('备份文件过大');
    const parsed=JSON.parse(await file.text());if(parsed.version!==1)throw Error('备份版本不支持');
    const incoming=normalize(parsed.data);
    if(!confirm('导入会替换此浏览器中现有的工作台数据。建议先导出备份。继续导入？'))return;
    save(incoming);await refresh();toast('备份已导入');
   }catch(error){toast(error.message||'无法读取此备份');}finally{event.target.value='';}
  };
  try{read();}catch{document.querySelector('#main').innerHTML='<div class="error-panel">浏览器存储不可用或原有数据无法读取。请使用 Chrome / Edge 的普通窗口打开，或导入有效备份。现有数据不会自动清除。</div>';}
 });
})();
