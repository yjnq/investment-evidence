import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
export const dateValue = z.string().refine(v => /^\d{4}-\d{2}-\d{2}(T.*(Z|[+-]\d{2}:\d{2}))?$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10) === v.slice(0,10), '请提供有效日期或带时区的时间').nullable();
export const materialSchema = z.object({
 title: z.string().trim().min(2).max(200), publisher: z.string().trim().min(1).max(100),
 url: z.string().url().refine(v => ['https:','http:'].includes(new URL(v).protocol)).nullable(),
 text: z.string().trim().min(10).max(20000), publishedAt: dateValue,
 occurredAt: dateValue, sourceUpdatedAt: dateValue,
 sourceType: z.enum(['official','media','research','anonymous']),
 sourceVerified: z.boolean().default(false),
 originalSource: z.string().trim().max(200).nullable(),
});
export type MaterialInput = z.infer<typeof materialSchema>;
export const extractionSchema = z.object({
 subject: z.string().min(1).max(100), target: z.string().min(1).max(100),
 transaction: z.string().min(1).max(120), title: z.string().min(1).max(200),
 stage: z.enum(['传出','筹划','签约','审批','完成','终止','未知']),
 claims: z.array(z.object({ key: z.string().min(1).max(100), text: z.string().min(1).max(500),
 type: z.enum(['fact','opinion','speculation','rumor']), quote: z.string().min(4).max(1000),
 relation: z.enum(['support','refute','correct','supplement']),
 replacesKey: z.string().max(100).nullable(), validUntil: dateValue,
 })).min(1).max(20),
});
export type Extraction = z.infer<typeof extractionSchema>;
export type Material = MaterialInput & {id:string; fingerprint:string; fetchedAt:string; mode:'live'|'fixture'; revisionOf:string|null};
export type Claim = Extraction['claims'][number] & {id:string; materialId:string; status:'未确认'|'有支持'|'已确认'|'有争议'|'被反驳'|'已更正'|'已失效'; weight:string; origin:string};
export type Version = {id:string; number:number; createdAt:string; stage:Extraction['stage']; reason:string; claims:Claim[]; materialIds:string[]};
export type Event = {id:string; identity:string; title:string; subject:string; target:string; transaction:string; mode:'live'|'fixture'; followed:boolean; versions:Version[]};
export type Task = {id:string; materialId:string; status:'processing'|'success'|'failed'; error:string|null; model:string|null; createdAt:string; finishedAt:string|null; extraction:Extraction|null};
export type Notice = {id:string; eventId:string; versionId:string; text:string; createdAt:string};
export type Workspace = {materials:Material[]; events:Event[]; tasks:Task[]; notices:Notice[]};
export const emptyWorkspace = ():Workspace => ({materials:[],events:[],tasks:[],notices:[]});
export const hash = (value:string) => createHash('sha256').update(value).digest('hex');
export const uid = () => randomUUID();
export const fingerprint = (m:MaterialInput) => hash(JSON.stringify([m.title,m.occurredAt,m.text.replace(/\s+/g,' ').trim(),m.publisher,m.url,m.publishedAt,m.sourceUpdatedAt,m.sourceType,m.originalSource,m.sourceVerified]));
export function validateExtraction(m:Material, extraction:Extraction){
 const result=extractionSchema.parse(extraction);
 for(const c of result.claims) if(!m.text.includes(c.quote)) throw new Error('引用校验失败：模型引用不在材料原文中');
 for(const entity of [result.subject,result.target]) if(!m.text.includes(entity)) throw new Error('主体校验失败：主体或交易对象未出现在原文');
 return result;
}
const canonical = (s:string) => s.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
export function applyExtraction(w:Workspace,m:Material,x:Extraction,now=new Date().toISOString()){
 validateExtraction(m,x);
 const identity=hash([m.mode,canonical(x.subject),canonical(x.target),canonical(x.transaction)].join('|'));
 let event=w.events.find(e=>e.identity===identity);
 for(const c of x.claims) if(c.replacesKey&&!event?.versions.at(-1)?.claims.some(old=>old.key===c.replacesKey)) throw new Error('引用校验失败：更正或反驳指向不存在的陈述');
 if(!event){event={id:uid(),identity,title:x.title,subject:x.subject,target:x.target,transaction:x.transaction,mode:m.mode,followed:false,versions:[]};w.events.push(event);}
 if(event.versions.some(v=>v.materialIds.includes(m.id))) return event;
 const previous=event.versions.at(-1);
 const claims:Claim[]=structuredClone(previous?.claims??[]);
 const origin=m.originalSource||m.url||m.publisher;
 let changed=false;
 for(const item of x.claims){
  // Reprints never count as independent corroboration.
  if(claims.some(c=>c.origin===origin&&c.key===item.key&&c.text===item.text&&c.relation===item.relation)) continue;
  const authoritative=m.sourceType==='official'&&m.sourceVerified&&!m.originalSource;
  let status:Claim['status']=item.type==='fact'?(authoritative?'已确认':'有支持'):'未确认';
  const related=claims.filter(c=>c.key===(item.replacesKey||item.key)&&!['已更正','已失效'].includes(c.status));
  if(item.relation==='correct'||item.relation==='refute'){
   for(const old of related){
    if(authoritative && item.replacesKey && m.publishedAt && w.materials.find(s=>s.id===old.materialId)?.publishedAt && Date.parse(m.publishedAt)>=Date.parse(w.materials.find(s=>s.id===old.materialId)!.publishedAt!)) old.status=item.relation==='correct'?'已更正':'被反驳';
    else {if(old.status!=='已确认')old.status='有争议';status='有争议';}
   }
  } else if(related.some(c=>c.relation==='refute')) status='有争议';
  claims.push({...item,id:uid(),materialId:m.id,status,origin,weight:authoritative?'直接披露 · 一手来源；仅确认所引述范围':m.originalSource?'转载 / 引用 · 与原来源同组，不增加独立性':m.sourceType==='anonymous'?'匿名来源 · 未经独立核验':'具名来源 · 尚待一手证据核验'});
  changed=true;
 }
 if(!changed&&previous)return event;
 // Older and weak sources cannot overwrite the last established business stage.
 const lastOfficialDate=previous?Math.max(0,...previous.materialIds.map(id=>w.materials.find(s=>s.id===id)).filter(s=>s?.sourceType==='official'&&s.sourceVerified&&!s.originalSource).map(s=>Date.parse(s?.publishedAt||'1970-01-01'))):0;
 const stage=m.sourceType==='official'&&m.sourceVerified&&!m.originalSource&&((m.publishedAt&&Date.parse(m.publishedAt)>=lastOfficialDate)||(!previous&&lastOfficialDate===0))?x.stage:previous?.stage??'未知';
 const version:Version={id:uid(),number:(previous?.number??0)+1,createdAt:now,stage,reason:`新增《${m.title}》；${x.claims.map(c=>({support:'支持',refute:'反驳',correct:'更正',supplement:'补充'}[c.relation])).filter((v,i,a)=>a.indexOf(v)===i).join('、')}相关陈述`,claims,materialIds:[...new Set([...(previous?.materialIds??[]),m.id])]};
 event.versions.push(version);
 if(event.followed)w.notices.unshift({id:uid(),eventId:event.id,versionId:version.id,text:`${event.title} · V${version.number}：${version.reason}`,createdAt:now});
 return event;
}
export function expireClaims(w:Workspace,now=new Date().toISOString()){
 let count=0;
 for(const e of w.events){const old=e.versions.at(-1);if(!old)continue;const claims=structuredClone(old.claims);let changed=false;
  for(const c of claims)if(c.validUntil&&!['已失效','已更正','被反驳'].includes(c.status)&&Date.parse(c.validUntil.length===10?`${c.validUntil}T23:59:59.999+08:00`:c.validUntil)<Date.parse(now)){c.status='已失效';changed=true;}
  if(!changed)continue;
  const v={...old,id:uid(),number:old.number+1,createdAt:now,claims,reason:'适用期限已届满；失效不表示陈述虚假或交易终止'};e.versions.push(v);count++;
  if(e.followed)w.notices.unshift({id:uid(),eventId:e.id,versionId:v.id,text:`${e.title}：${v.reason}`,createdAt:now});
 }return count;
}
