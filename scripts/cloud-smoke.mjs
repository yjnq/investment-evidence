import postgres from 'postgres';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function runCloudSmoke(){
 const runId=process.env.CLOUD_SMOKE_RUN;
 if(!runId||!process.env.DATABASE_URL||!process.env.APP_ACCESS_TOKEN)return;
 const db=postgres(process.env.DATABASE_URL,{max:1,connect_timeout:10});
 const report={runId,startedAt:new Date().toISOString(),checks:[],ok:false};
 let claimed=false;
 try{
  await db`CREATE TABLE IF NOT EXISTS verification_runs (id text PRIMARY KEY, report jsonb NOT NULL)`;
  const rows=await db`INSERT INTO verification_runs(id,report) VALUES (${runId},${db.json(report)}) ON CONFLICT DO NOTHING RETURNING id`;
  if(!rows.length){console.log('CLOUD_SMOKE_ALREADY_RECORDED',runId);return;}claimed=true;
  const root='http://127.0.0.1:'+(process.env.PORT||3000);
  const headers={'Content-Type':'application/json','x-access-token':process.env.APP_ACCESS_TOKEN};
  async function call(path,body,authorized=true){const r=await fetch(root+path,{method:body===undefined?'GET':'POST',headers:authorized?headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(110000)});return {http:r.status,data:await r.json()};}
  async function check(name,fn){try{const details=await fn();report.checks.push({name,ok:true,...details});}catch(e){report.checks.push({name,ok:false,error:e instanceof assert.AssertionError?'assertion_failed':e?.name||'Error'});}console.log('CLOUD_SMOKE_CHECK',JSON.stringify(report.checks.at(-1)));}
  let ready=false;
  for(let i=0;i<30;i++){try{const r=await call('/api/workspace');if(r.http===200){ready=true;break;}}catch{}await pause(2000);}
  assert.ok(ready,'healthcheck');
  await check('database',async()=>{const r=await call('/api/workspace');assert.equal(r.data.configuration.database,'PostgreSQL');assert.equal(r.data.configuration.writeProtected,true);return {http:r.http};});
  await check('unauthorized-write',async()=>{const r=await call('/api/demo',{step:0},false);assert.notEqual(r.http,200);return {http:r.http};});
  await check('gpt-real-material',async()=>{const material=JSON.parse(await readFile(new URL('../data/real-case-csrc.json',import.meta.url),'utf8'));const r=await call('/api/ingest',material);assert.equal(r.http,200);const w=(await call('/api/workspace')).data;const m=w.materials.find(m=>m.title===material.title);const event=w.events.find(e=>e.versions.some(v=>v.materialIds.includes(m.id)));assert.ok(event);assert.equal(event.versions.at(-1).stage,'审批');return {http:r.http,eventId:event.id,claims:event.versions.at(-1).claims.length,duplicate:!!r.data.duplicate};});
  await check('ifind-live-search',async()=>{const r=await call('/api/search',{query:'国泰君安 海通证券',start:'2024-09-01',end:'2024-09-30'});assert.equal(r.http,200);assert.ok(Array.isArray(r.data.candidates));return {http:r.http,candidates:r.data.candidates.length,...(!r.data.candidates.length?{note:'upstream_empty'}:{})};});
  await check('versions-notices-and-idempotency',async()=>{await call('/api/demo',{step:0});let w=(await call('/api/workspace')).data;const e=w.events.find(e=>e.mode==='fixture'&&e.target==='示例芯片');assert.ok(e);const first=JSON.stringify(e.versions[0]);await call('/api/follow',{eventId:e.id,followed:true});for(const step of [1,2,3,4]){const r=await call('/api/demo',{step});assert.equal(r.http,200);}await call('/api/expire',{});w=(await call('/api/workspace')).data;const current=w.events.find(x=>x.id===e.id);assert.equal(current.versions.at(-1).claims.find(c=>c.key==='price').status,'已更正');assert.equal(current.versions.at(-1).claims.find(c=>c.key==='forecast').status,'已失效');assert.equal(JSON.stringify(current.versions[0]),first);assert.ok(w.events.some(e=>e.target==='示例软件'));const n=w.notices.length,v=current.versions.length;await call('/api/demo',{step:3});await call('/api/expire',{});const after=(await call('/api/workspace')).data;assert.equal(after.notices.length,n);assert.equal(after.events.find(e=>e.id===current.id).versions.length,v);return {versions:v,notices:n};});
  report.ok=report.checks.every(c=>c.ok);
 }catch(e){report.runnerError=e instanceof assert.AssertionError?'healthcheck_not_ready':e?.name||'Error';}
 finally{
  report.finishedAt=new Date().toISOString();
  if(claimed){await db`UPDATE verification_runs SET report=${db.json(report)} WHERE id=${runId}`;console.log('CLOUD_SMOKE_RESULT',JSON.stringify(report));}
  await db.end();
 }
}
