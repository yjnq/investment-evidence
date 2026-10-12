import {describe,it,expect} from 'vitest';
import {parseNoticeResponse,searchSchema} from '../src/lib/ifind';
const wrap=(data:unknown,code=1)=>({result:{content:[{type:'text',text:JSON.stringify({code,data:JSON.stringify(data)})}]}});
describe('资讯候选响应边界',()=>{
 it('检查内层业务码，不将HTTP成功当成数据成功',()=>{expect(()=>parseNoticeResponse(wrap([],0),'2025-01-01','2025-01-31')).toThrow('业务失败');});
 it('过滤上游返回的窗口外数据，保留空结果',()=>{expect(parseNoticeResponse(wrap([{'公告标题':'旧公告','公告片段内容':'内容','日期':'2024-01-01'}]),'2025-01-01','2025-01-31')).toEqual({candidates:[],excluded:1});});
 it('未知日期保留null，不伪造日期或链接',()=>{const r=parseNoticeResponse(wrap([{'公告标题':'公告','公告片段内容':'内容','日期':'未知'}]),'2025-01-01','2025-01-31');expect(r.candidates[0]).toEqual({title:'公告',text:'内容',publishedAt:null,url:null});});
 it('忽略备注行并拒绝脚本链接',()=>{const r=parseNoticeResponse(wrap([{'备注':'仅片段'},{'公告标题':'公告','公告片段内容':'内容','url':'javascript:alert(1)'}]),'2025-01-01','2025-01-31');expect(r.candidates).toHaveLength(1);expect(r.candidates[0].url).toBeNull();});
 it('拒绝结构变化，不返回假成功',()=>{expect(()=>parseNoticeResponse({html:'error'},'2025-01-01','2025-01-31')).toThrow();});
 it('拒绝倒置窗口及无效日期',()=>{expect(searchSchema.safeParse({query:'国泰君安',start:'2025-02-30',end:'2025-03-31'}).success).toBe(false);expect(searchSchema.safeParse({query:'国泰君安',start:'2025-03-01',end:'2025-02-01'}).success).toBe(false);});
});

import {afterEach,vi} from 'vitest';
import {searchNotices} from '../src/lib/ifind';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('MCP会话响应',()=>{
 it('初始化通知可以用纯文本确认，不应阻断后续查询',async()=>{
  vi.stubEnv('IFIND_AUTH_TOKEN','test-only-token');
  const mock=vi.fn().mockResolvedValueOnce(new Response('{"result":{}}',{headers:{'mcp-session-id':'test-session'}})).mockResolvedValueOnce(new Response('Accepted',{status:202})).mockResolvedValueOnce(new Response(JSON.stringify(wrap([{'公告标题':'测试公告','公告片段内容':'测试原文','日期':'2025-01-02'}]))));
  vi.stubGlobal('fetch',mock);
  const result=await searchNotices({query:'测试',start:'2025-01-01',end:'2025-01-31'});
  expect(result.candidates).toHaveLength(1);
  expect(mock.mock.calls[2][1].headers['Mcp-Session-Id']).toBe('test-session');
 });
});

describe('公告结构化文本兼容',()=>{
 it('接受完整JSON代码围栏，不修补或猜测内容',()=>{
  const records=[{'公告标题':'公告','公告片段内容':'片段','日期':'2025-01-02'}];
  const raw={result:{content:[{type:'text',text:'```json\n'+JSON.stringify({code:1,data:'```json\n'+JSON.stringify(records)+'\n```'})+'\n```'}]}};
  expect(parseNoticeResponse(raw,'2025-01-01','2025-01-31').candidates).toHaveLength(1);
 });
 it('单独说明文本不拼接到JSON业务结果中',()=>{
  const raw=wrap([{'公告标题':'公告','公告片段内容':'片段'}]);raw.result.content.push({type:'text',text:'仅返回公告候选片段，请核对原文'});
  expect(parseNoticeResponse(raw,'2025-01-01','2025-01-31').candidates).toHaveLength(1);
 });
 it('拒绝多个业务结果，避免取错信封',()=>{
  const raw=wrap([]);raw.result.content.push(raw.result.content[0]);expect(()=>parseNoticeResponse(raw,'2025-01-01','2025-01-31')).toThrow('不唯一');
 });
 it('拒绝尾随指令与截断JSON，不把失败降级为无数据',()=>{
  const raw={result:{content:[{type:'text',text:JSON.stringify({code:1,data:'[{"公告标题":"截断"'})}]}};
  expect(()=>parseNoticeResponse(raw,'2025-01-01','2025-01-31')).toThrow('完整JSON');
 });
});
describe('供应商明确空结果',()=>{
 it('将已观察的Markdown无结果说明视为合法空集合',()=>{const raw={result:{content:[{type:'text',text:JSON.stringify({code:1,data:'# 查询结果\n抱歉，本次新闻搜索结果为空\n## 可能原因\n时间参数区间过于严格'})}]}};const r=parseNoticeResponse(raw,'2025-01-01','2025-01-31');expect(r.candidates).toEqual([]);expect(r).toHaveProperty('emptyReason');});
 it('不把未识别权限/异常文字当成无结果',()=>{const raw={result:{content:[{type:'text',text:JSON.stringify({code:1,data:'权限不足，请重新认证'})}]}};expect(()=>parseNoticeResponse(raw,'2025-01-01','2025-01-31')).toThrow('完整JSON');});
});
