import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {dateValue} from './domain';
export const searchSchema=z.object({query:z.string().trim().min(2).max(200),start:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),end:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).refine(x=>dateValue.safeParse(x.start).success&&dateValue.safeParse(x.end).success&&x.start<=x.end,'查询日期无效');
const endpoint='https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-news-mcp';
export type Candidate={title:string;text:string;publishedAt:string|null;url:string|null};
let inFlight=false;
export function decodeToolJson(text:string,layer:string):unknown {
 const trimmed=text.trim();
 const fenced=trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
 const payload=fenced?fenced[1]:trimmed;
 try{return JSON.parse(payload);}catch{
  const hint=trimmed.replace(/[^\u3400-\u9fff\s。，：；！？（）]/g,'').slice(0,120);
  console.error('ifind_json_invalid',{layer,shape:fenced?'fenced':trimmed.startsWith('{')?'object':trimmed.startsWith('[')?'array':'other',characters:trimmed.length,hint});
  throw new Error(`资讯接口响应校验失败（${layer}）：内容不是完整JSON，请重新检索`);
 }
}
export function parseNoticeResponse(raw:unknown,start:string,end:string){
 const outer=z.object({result:z.object({isError:z.boolean().optional(),content:z.array(z.object({type:z.string(),text:z.string().optional()}))})}).parse(raw);
 if(outer.result.isError)throw new Error('资讯接口业务失败');
 const envelopes:unknown[]=[];
 for(const block of outer.result.content){
  if(block.type!=='text'||!block.text)continue;
  if(!/^(?:\{|\[|```)/.test(block.text.trim()))continue;
  const value=decodeToolJson(block.text,'business-envelope');
  if(value&&typeof value==='object'&&'code' in value)envelopes.push(value);
 }
 if(envelopes.length!==1)throw new Error('资讯接口响应校验失败：业务结果缺失或不唯一');
 const envelope=z.object({code:z.number(),data:z.unknown()}).parse(envelopes[0]);
 if(envelope.code!==1)throw new Error('资讯接口业务失败');
 const records=z.array(z.record(z.string(),z.unknown())).parse(typeof envelope.data==='string'?decodeToolJson(envelope.data,'notice-records'):envelope.data);
 const candidates:Candidate[]=[];let excluded=0;
 for(const row of records){const title=row['公告标题'],body=row['公告片段内容'],date=row['日期'];if(typeof title!=='string'||typeof body!=='string')continue;
  const publishedAt=typeof date==='string'&&dateValue.safeParse(date).success?date:null;
  if(publishedAt&&(publishedAt.slice(0,10)<start||publishedAt.slice(0,10)>end)){excluded++;continue;}
  const rawURL=row['公告链接']??row['url'];let url:string|null=null;try{if(typeof rawURL==='string'&&new URL(rawURL).protocol==='https:')url=rawURL;}catch{}
  candidates.push({title:title.slice(0,200),text:body.slice(0,20000),publishedAt,url});
 }return {candidates,excluded};
}
export async function searchNotices(input:z.infer<typeof searchSchema>){
 if(inFlight)throw new Error('资讯查询正在处理中，请稍后重试');
 inFlight=true;
 let stage='credential';
 try{
  let token=process.env.IFIND_AUTH_TOKEN;
  if(!token&&process.env.IFIND_CONFIG_PATH)token=JSON.parse(await readFile(process.env.IFIND_CONFIG_PATH,'utf8')).auth_token;
  if(!token)throw new Error('iFinD 尚未配置');
  let session:string|null=null,id=0;
  const rpc=async(method:string,params?:unknown,notify=false)=>{
   stage=method;
   const r=await fetch(endpoint,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(55000),headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:token!,...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',...(notify?{}:{id:++id}),method,...(params?{params}:{})})});
   if(!r.ok)throw new Error(`资讯接口失败（HTTP ${r.status}）`);
   if(method==='initialize')session=r.headers.get('mcp-session-id');
   const t=await r.text();if(notify)return null;return t?JSON.parse(t):null;
  };
  await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'event-evidence',version:'0.1.0'}});
  if(!session)throw new Error('资讯接口会话校验失败');
  await rpc('notifications/initialized',undefined,true);
  const raw=await rpc('tools/call',{name:'search_notice',arguments:{query:input.query,time_start:input.start,time_end:input.end,size:5}});
  stage='parse-result';
  return {...parseNoticeResponse(raw,input.start,input.end),fetchedAt:new Date().toISOString(),provider:'iFinD',mode:'在线候选检索'};
 }catch(e){const rawCode=(e as {cause?:{code?:unknown}})?.cause?.code;const code=typeof rawCode==='string'&&/^[A-Z_0-9]+$/.test(rawCode)?rawCode:'UNKNOWN';console.error('ifind_request_failed',{stage,errorType:e instanceof Error?e.name:'Unknown',code});if(e instanceof Error&&/尚未配置|业务失败|HTTP|校验失败/.test(e.message))throw e;throw new Error('资讯接口网络或响应校验失败；未生成任何结论');}finally{inFlight=false;}
}
