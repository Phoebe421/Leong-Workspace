// Run with node research.test.cjs app.js (source) or research.html (standalone).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let src=fs.readFileSync(process.argv[2]||'app.js','utf8');if(src.includes('<!doctype'))src=src.match(/<script>([\s\S]*?)<\/script>/)[1];
const el=()=>({innerHTML:'',textContent:'',value:'',style:{},classList:{toggle(){}},addEventListener(){},showModal(){},close(){}}),nodes=new Map();
const context={console,Date,URL,Blob,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,location:{hash:''},localStorage:{getItem(){return null;},setItem(){}},document:{querySelector(s){if(!nodes.has(s))nodes.set(s,el());return nodes.get(s);},querySelectorAll(){return[];},addEventListener(){}},window:{addEventListener(){}},navigator:{}};vm.createContext(context);vm.runInContext(src,context);
const run=s=>vm.runInContext(s,context);assert.equal(run('validate(initial()).tasks.length'),3);assert.equal(run('validate(initial()).papers.length'),0);
assert.throws(()=>run("validate({...initial(),version:2})"));assert.throws(()=>run("validate({...initial(),project:{...initial().project,deadline:'2026-02-30'}})"));
assert.throws(()=>run("validate({...initial(),tasks:[{...initial().tasks[0],paper:'missing'}]})"));assert.throws(()=>run("validate({...initial(),decisions:[{id:'a',title:'x',status:'unknown'}]})"));
assert.equal(run("safeURL('javascript:alert(1)')"),'');assert.equal(run("safeURL('https://user:password@example.com')"),'');assert.ok(run("esc('<img src=x onerror=alert(1)>')").includes('&lt;'));
assert.equal(run("validate(JSON.parse(JSON.stringify(initial()))).project.stage"),'研究问题与数据可行性确认');
assert.throws(()=>run("(()=>{const s=initial();s.tasks=[s.tasks[0],s.tasks[0]];return validate(s)})()"));
assert.equal(run("sourceLinks({doi:'javascript:alert(1)',zotero:'javascript:alert(1)'})"),'来源待补充');
run("state.tasks[0].status='已完成'");assert.equal(run('sortedTasks().length'),2);
console.log('PASS: backup round-trip, schema/date/enum/id/reference checks, escaped content, safe links, task ordering');
