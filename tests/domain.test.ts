import {describe,it,expect} from 'vitest';
import {applyExtraction,emptyWorkspace,expireClaims,fingerprint,materialSchema,validateExtraction,type Material} from '../src/lib/domain';
import { fixtures } from '../src/lib/fixtures';
function setup(){const w=emptyWorkspace();const add=(i:number)=>{const f=fixtures[i];const m:Material={...f.material,id:`m${i}`,fingerprint:fingerprint(f.material),mode:'fixture',fetchedAt:'2026-01-20T01:00:00Z',revisionOf:null};if(!w.materials.find(o=>o.id===m.id))w.materials.push(m);return applyExtraction(w,m,f.extraction,`2026-01-${20+i}T01:00:00Z`);};return {w,add};}
describe('事件证据与版本',()=>{
 it('传闻保持未确认，不能确认业务签约',()=>{const {add}=setup();const e=add(0);expect(e.versions[0].claims.every(c=>c.status==='未确认')).toBe(true);expect(e.versions[0].stage).toBe('未知');});
 it('同一交易的部分否认合并，历史快照不被改写',()=>{const {add,w}=setup();add(0);const original=JSON.stringify(w.events[0].versions[0]);const e=add(1);expect(w.events).toHaveLength(1);expect(e.versions[1].claims.find(c=>c.key==='agreement')?.status).toBe('被反驳');expect(e.versions[1].claims.find(c=>c.key==='forecast')?.status).toBe('未确认');expect(JSON.stringify(e.versions[0])).toBe(original);});
 it('跨时间的签约进展不反证先前的未签约事实',()=>{const {add}=setup();add(0);add(1);const e=add(2);expect(e.versions.at(-1)?.stage).toBe('签约');expect(e.versions.at(-1)?.claims.find(c=>c.key==='no-agreement')?.status).toBe('已确认');});
 it('更正保留旧值和旧版本；新值可追到材料',()=>{const {add}=setup();add(2);const e=add(3);expect(e.versions[0].claims.find(c=>c.key==='price')?.status).toBe('已确认');expect(e.versions[1].claims.find(c=>c.key==='price')?.status).toBe('已更正');expect(e.versions[1].claims.find(c=>c.key==='correct-price')?.materialId).toBe('m3');});
 it('同公司不同交易不合并',()=>{const {add,w}=setup();add(2);add(4);expect(w.events).toHaveLength(2);});
 it('重复材料不会产生新版本或通知',()=>{const {add,w}=setup();const e=add(0);e.followed=true;add(1);add(1);expect(e.versions).toHaveLength(2);expect(w.notices).toHaveLength(1);});
 it('关注前不通知；关注后每个新版本通知一次',()=>{const {add,w}=setup();const e=add(0);expect(w.notices).toHaveLength(0);e.followed=true;add(1);add(2);expect(w.notices).toHaveLength(2);expect(new Set(w.notices.map(n=>n.versionId)).size).toBe(2);});
 it('到期检查幂等，不把过期当终止或虚假',()=>{const {add,w}=setup();const e=add(0);e.followed=true;expect(expireClaims(w,'2026-01-13T00:00:00Z')).toBe(1);expect(expireClaims(w,'2026-01-13T00:00:00Z')).toBe(0);expect(e.versions.at(-1)?.claims.find(c=>c.key==='forecast')?.status).toBe('已失效');expect(e.versions.at(-1)?.stage).not.toBe('终止');expect(w.notices).toHaveLength(1);});
 it('伪造引用拒绝形成事件',()=>{const {w}=setup();const m={...fixtures[0].material,id:'x',fingerprint:'x',mode:'fixture' as const,fetchedAt:'2026-01-01',revisionOf:null};const x=structuredClone(fixtures[0].extraction);x.claims[0].quote='原文不存在的证据';expect(()=>applyExtraction(w,m,x)).toThrow('引用');expect(w.events).toHaveLength(0);});
 it('未出现的实体拒绝',()=>{const m={...fixtures[0].material,id:'x',fingerprint:'x',mode:'fixture' as const,fetchedAt:'2026-01-01',revisionOf:null};expect(()=>validateExtraction(m,{...fixtures[0].extraction,target:'幻觉公司'})).toThrow('主体');});
 it('新弱来源不能覆盖旧正式业务阶段',()=>{const {add,w}=setup();const e=add(2);const m={...fixtures[0].material,id:'weak',fingerprint:'weak',mode:'fixture' as const,publishedAt:'2026-01-30',fetchedAt:'2026-01-30',revisionOf:null};w.materials.push(m);applyExtraction(w,m,fixtures[0].extraction);expect(e.versions.at(-1)?.stage).toBe('签约');});
 it('晚到旧披露不能倒退业务阶段',()=>{const {add}=setup();add(0);add(2);const e=add(1);expect(e.versions.at(-1)?.stage).toBe('签约');});
 it('同源转载不形成新版本',()=>{const {add,w}=setup();const e=add(2);const original=w.materials[0];const m={...original,id:'reprint',publisher:'转载媒体',sourceType:'media' as const,originalSource:original.publisher};w.materials.push(m);applyExtraction(w,m,fixtures[2].extraction);expect(e.versions).toHaveLength(1);});
 it('原文相同但来源更新有变，保留不同指纹',()=>{expect(fingerprint(fixtures[2].material)).not.toBe(fingerprint({...fixtures[2].material,sourceUpdatedAt:'2026-01-16'}));});
 it.each(['2026-02-30','garbage','2026-13-01'])('拒绝非法日期 %s',value=>{expect(materialSchema.safeParse({...fixtures[0].material,publishedAt:value}).success).toBe(false);});
 it('拒绝脚本链接与超长文本',()=>{expect(materialSchema.safeParse({...fixtures[0].material,url:'javascript:alert(1)'}).success).toBe(false);expect(materialSchema.safeParse({...fixtures[0].material,text:'a'.repeat(20001)}).success).toBe(false);});
 it('允许未知时间，不以当前时间补齐',()=>{const m=materialSchema.parse({...fixtures[0].material,publishedAt:null});expect(m.publishedAt).toBeNull();});
});
describe('补充防错',()=>{
 it('来源类别自报但未核验，不标记已确认',()=>{const w=emptyWorkspace();const f=fixtures[2];const m:Material={...f.material,sourceVerified:false,id:'m',fingerprint:'m',mode:'live',fetchedAt:'2026-01-20',revisionOf:null};w.materials.push(m);const e=applyExtraction(w,m,f.extraction);expect(e.versions[0].claims.some(c=>c.status==='已确认')).toBe(false);});
 it('更正不能指向不存在的陈述',()=>{const w=emptyWorkspace();const f=fixtures[3];const m:Material={...f.material,id:'m',fingerprint:'m',mode:'fixture',fetchedAt:'2026-01-20',revisionOf:null};expect(()=>applyExtraction(w,m,f.extraction)).toThrow('不存在');expect(w.events).toHaveLength(0);});
 it('日期截止按上海时区当日结束计算',()=>{const {w,add}=setup();add(0);expect(expireClaims(w,'2026-01-12T15:59:59Z')).toBe(0);expect(expireClaims(w,'2026-01-12T16:00:00Z')).toBe(1);});
 it('接受跨UTC日期但有效的带时区时间',()=>{expect(materialSchema.safeParse({...fixtures[0].material,publishedAt:'2026-01-12T00:05:00+08:00'}).success).toBe(true);});
});
describe('显式事件匹配',()=>{
 it('同一公司全称与省略公司后缀可归入明确候选，并记录理由',()=>{
  const {w,add}=setup();const e=add(2);
  const f=fixtures[2];const m:Material={...f.material,id:'later',fingerprint:'later',text:f.material.text.replaceAll('示例科技','示例科技股份有限公司'),mode:'fixture',fetchedAt:'2026-01-20',revisionOf:null};w.materials.push(m);
  const x={...f.extraction,subject:'示例科技股份有限公司',match:{eventId:e.id,reason:'相同交易双方与2026年控制权收购事项',quote:m.text},claims:f.extraction.claims.map(c=>({...c,quote:c.quote.replaceAll('示例科技','示例科技股份有限公司')}))};
  expect(applyExtraction(w,m,x).id).toBe(e.id);expect(w.events).toHaveLength(1);
 });
 it('候选ID不能强制把不同交易对象合并',()=>{
  const {w,add}=setup();const e=add(2);const f=fixtures[4];const m:Material={...f.material,id:'different',fingerprint:'different',mode:'fixture',fetchedAt:'2026-01-20',revisionOf:null};
  expect(()=>applyExtraction(w,m,{...f.extraction,match:{eventId:e.id,reason:'恶意要求合并不同的交易对象',quote:m.text}})).toThrow('交易');expect(w.events).toHaveLength(1);
 });
 it('同一双方不同交易批次保持分开并提示复核',()=>{
  const {w,add}=setup();add(2);const f=fixtures[2];const m:Material={...f.material,id:'next-year',fingerprint:'next-year',mode:'fixture',fetchedAt:'2027-01-20',revisionOf:null};w.materials.push(m);
  const e=applyExtraction(w,m,{...f.extraction,transaction:'2027年另一笔资产收购'});expect(w.events).toHaveLength(2);expect(e.reviewReason).toContain('保持分开');
 });
 it('不存在的候选ID与伪造匹配引用均拒绝',()=>{
  const {w}=setup();const f=fixtures[2];const m:Material={...f.material,id:'x',fingerprint:'x',mode:'fixture',fetchedAt:'2026-01-20',revisionOf:null};
  expect(()=>applyExtraction(w,m,{...f.extraction,match:{eventId:'missing',reason:'错误候选引用不能创建事件',quote:m.text}})).toThrow('不存在');expect(w.events).toHaveLength(0);
  expect(()=>validateExtraction(m,{...f.extraction,match:{eventId:'missing',reason:'原文不存在的匹配依据测试',quote:'虚构的引用内容'}})).toThrow('匹配依据');
 });
});

import {sameEntity} from '../src/lib/domain';
describe('简称与阶段时间',()=>{
 it('仅从核对过的一手来源接受明确的简称定义',()=>{const m:Material={...fixtures[2].material,id:'alias',fingerprint:'alias',mode:'fixture',fetchedAt:'2026-01-20',revisionOf:null,text:'国泰君安证券股份有限公司（以下简称国泰君安）拟吸收合并海通证券。'};expect(sameEntity('国泰君安','国泰君安证券股份有限公司',[m])).toBe(true);expect(sameEntity('国泰君安','国泰君安证券股份有限公司',[{...m,sourceVerified:false}])).toBe(false);});
 it('晚获取旧材料不能把已有明确发生日期的审批阶段倒退',()=>{const w=emptyWorkspace();const f=fixtures[2];const newer:Material={...f.material,id:'new',fingerprint:'new',mode:'fixture',publishedAt:null,occurredAt:'2026-02-01',fetchedAt:'2026-10-12',revisionOf:null};w.materials.push(newer);const e=applyExtraction(w,newer,{...f.extraction,stage:'审批'});const older={...newer,id:'old',fingerprint:'old',publishedAt:'2026-01-15',occurredAt:'2026-01-14',publisher:'另一一手来源'};w.materials.push(older);applyExtraction(w,older,f.extraction);expect(e.versions.at(-1)?.stage).toBe('审批');expect(newer.publishedAt).toBeNull();});
});
