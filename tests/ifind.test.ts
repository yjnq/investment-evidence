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
