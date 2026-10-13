/* Run: python3 tools/export_standalone.py && node tests/calendar.browser.cjs */
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
let playwright;
try{playwright=require('playwright');}catch{try{playwright=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}catch{throw Error('Install Playwright for browser tests: npm install --no-save --package-lock=false playwright; npx playwright install chromium');}}
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'exports/Leong-Workspace.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  const executable=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await playwright.chromium.launch({headless:true,...(executable?{executablePath:executable}: {})});
  const context=await browser.newContext({timezoneId:'Asia/Shanghai',viewport:{width:1440,height:1050}});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  const old=JSON.parse(fs.readFileSync(path.join(root,'tools/personal-plan.json'),'utf8'));old.tasks[0].title='原有任务不得覆盖';
  await p.addInitScript(value=>{if(!localStorage.getItem('leong-personal-workspace-v1'))localStorage.setItem('leong-personal-workspace-v1',JSON.stringify(value));},old);
  await p.goto(`http://127.0.0.1:${server.address().port}`);
  await p.locator('nav a[data-page=calendar]').click();
  await p.getByRole('heading',{name:'智能日历',exact:true}).waitFor();
  assert.equal(await p.locator('.cal-day-column').count(),7);
  await p.locator('[data-cal-view=month]').click();assert.equal(await p.locator('.cal-month-cell').count(),42);
  await p.locator('[data-cal-view=day]').click();assert.equal(await p.locator('.cal-day-column').count(),1);
  await p.locator('[data-cal-view=week]').click();
  const date=await p.locator('.cal-day-column').nth(2).getAttribute('data-cal-drop');
  await p.locator('[data-cal-new]').click();
  await p.locator('#cal-form [name=title]').fill('<script>雅思阅读</script>');
  await p.locator('#cal-form [name=start]').fill(date+'T14:00');
  await p.locator('#cal-form [name=end]').fill(date+'T13:00');
  await p.getByRole('button',{name:'保存日程',exact:true}).click();
  assert.match(await p.locator('#cal-form-error').textContent(),/结束时间必须晚于/);
  await p.locator('#cal-form [name=end]').fill(date+'T15:00');
  await p.locator('#cal-form [name=category]').selectOption('research');
  await p.locator('#cal-form [name=color]').fill('#ff3366');
  await p.locator('#cal-form [name=done]').check();
  await p.getByRole('button',{name:'保存日程',exact:true}).click();await p.locator('#cal-dialog').waitFor({state:'hidden'});
  let items=await p.evaluate(()=>Calendar.backup());assert.equal(items.length,1);assert.equal(items[0].color,'#ff3366');assert.equal(items[0].done,true);
  await p.reload();await p.getByRole('heading',{name:'智能日历',exact:true}).waitFor();
  assert.equal((await p.evaluate(()=>Calendar.backup())).length,1);
  const id=items[0].id;
  await p.locator('.cal-time-scroll').evaluate(el=>el.scrollTop=550);
  await p.locator(`[data-cal-edit="${id}"]`).click();
  await p.locator('#cal-form [name=end]').fill(date+'T15:30');await p.getByRole('button',{name:'保存日程',exact:true}).click();await p.locator('#cal-dialog').waitFor({state:'hidden'});
  await p.locator('[data-cal-view=month]').click();
  const next=await p.evaluate(date=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');},date);
  await p.locator(`[data-cal-drag="${id}"]`).dragTo(p.locator(`.cal-month-cell[data-cal-drop="${next}"]`));
  items=await p.evaluate(()=>Calendar.backup());assert.equal(items[0].start,next+'T14:00');assert.equal(items[0].end,next+'T15:30');
  await p.locator('[data-cal-view=week]').click();await p.locator('.cal-time-scroll').evaluate(el=>el.scrollTop=500);
  const handle=await p.locator(`[data-cal-handle="${id}"]`).boundingBox(),column=await p.locator(`.cal-day-column[data-cal-drop="${next}"]`).boundingBox();
  await p.mouse.move(handle.x+8,handle.y+8);await p.mouse.down();await p.mouse.move(column.x+column.width/2,column.y+16*48+8,{steps:8});await p.mouse.up();
  items=await p.evaluate(()=>Calendar.backup());assert.equal(items[0].start,next+'T16:00');assert.equal(items[0].end,next+'T17:30');
  await p.locator('#cal-filter').selectOption('life');assert.equal(await p.locator('.cal-event').count(),0);
  await p.locator('#cal-filter').selectOption('research');assert.equal(await p.locator('.cal-event').count(),1);
  await p.locator('[data-cal-theme]').click();assert.equal(await p.locator('.calendar-module.cal-dark').count(),1);
  await p.reload();assert.equal(await p.locator('.calendar-module.cal-dark').count(),1);
  const invariants=await p.evaluate(()=>{
   const item=Calendar.backup()[0];let rejected=0;
   for(const value of [{...item,end:item.start},{...item,color:'url(bad)'},{...item,start:'2026-02-30T10:00'},{...item,category:'__proto__'}]){try{Calendar.validate([value]);}catch{rejected++;}}
   const cross={...item,id:'cross',start:'2026-10-13T23:30',end:'2026-10-14T00:30'};
   const overlap={...item,id:'overlap',start:'2026-10-14T00:15',end:'2026-10-14T01:00'};
   const layout=Calendar.layout([cross,overlap],new Date('2026-10-14T00:00:00'));
   return {rejected,columns:layout.map(x=>x.columns),count:layout.length};
  });assert.equal(invariants.rejected,4);assert.deepEqual(invariants.columns,[2,2]);
  const downloadPromise=p.waitForEvent('download');await p.locator('[data-cal-export]').click();const download=await downloadPromise;const downloaded=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(downloaded.events[0].id,id);
  await p.locator('.cal-time-scroll').evaluate(el=>el.scrollTop=600);
  await p.locator(`[data-cal-edit="${id}"]`).click();await p.locator('[data-cal-delete]').click();await p.locator('#cal-dialog').waitFor({state:'hidden'});assert.equal((await p.evaluate(()=>Calendar.backup())).length,0);
  await p.locator('#cal-file').setInputFiles({name:'calendar.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(downloaded))});
  await p.waitForFunction(()=>Calendar.backup().length===1);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('leong-personal-workspace-v1')).tasks[0].title),'原有任务不得覆盖');
  await p.setViewportSize({width:390,height:844});await p.locator('[data-cal-view=month]').click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: day/week/month, CRUD, validation, reload, month drag, quarter-hour pointer drag with duration preservation, colors, categories, completion, dark theme, overlap/cross-day layout, backup import/export, legacy data and mobile layout.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
