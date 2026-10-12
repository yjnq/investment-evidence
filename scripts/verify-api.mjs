import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const root=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
const headers={'Content-Type':'application/json','x-access-token':process.env.APP_ACCESS_TOKEN||''};
async function state(){const r=await fetch(root+'/api/workspace');assert.equal(r.status,200);return r.json();}
async function post(path,body){const r=await fetch(root+path,{method:'POST',headers,body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
let w=await state();const e=w.events.find(e=>e.mode==='fixture'&&e.target==='示例芯片');assert.ok(e,'先运行沙盒前三步');const original=JSON.stringify(e.versions[0]);
await post('/api/follow',{eventId:e.id,followed:true});
await post('/api/demo',{step:3});w=await state();const corrected=w.events.find(x=>x.id===e.id);assert.equal(corrected.versions.at(-1).claims.find(c=>c.key==='price').status,'已更正');assert.equal(corrected.versions.at(-1).claims.find(c=>c.key==='correct-price').text,'交易对价更正为9亿元');
const versions=corrected.versions.length,notices=w.notices.length;
await post('/api/demo',{step:3});w=await state();assert.equal(w.events.find(x=>x.id===e.id).versions.length,versions);assert.equal(w.notices.length,notices);
await post('/api/demo',{step:4});w=await state();assert.ok(w.events.some(e=>e.target==='示例软件'));
await post('/api/expire',{});w=await state();const expired=w.events.find(x=>x.id===e.id);assert.equal(expired.versions.at(-1).claims.find(c=>c.key==='forecast').status,'已失效');assert.equal(JSON.stringify(expired.versions[0]),original);
const afterCount=w.notices.length;await post('/api/expire',{});w=await state();assert.equal(w.notices.length,afterCount);
const invalid=await fetch(root+'/api/ingest',{method:'POST',headers,body:JSON.stringify({title:'bad'})});assert.equal(invalid.status,400);
const final=await state();const real=final.events.find(e=>e.subject.includes('国泰君安'));assert.ok(real);assert.equal(real.versions.at(-1).stage,'审批');
const result={testedAt:new Date().toISOString(),checks:['部分金额更正','重复材料幂等','通知去重','不同交易分离','过期幂等','历史快照不变','非法输入拒绝','真实模型案例已保存'],eventCount:final.events.length,materialCount:final.materials.length,versionCount:final.events.reduce((n,e)=>n+e.versions.length,0),noticeCount:final.notices.length,realModelTasks:final.tasks.filter(t=>t.model&&!t.model.includes('人工')).map(t=>({id:t.id,model:t.model,status:t.status,createdAt:t.createdAt,finishedAt:t.finishedAt})),realCaseClaims:real.versions.at(-1).claims};
await writeFile('docs/api-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,realCaseClaims:result.realCaseClaims.length}));
