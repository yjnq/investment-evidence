import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
const attempts=new Map<string,{count:number;expires:number}>();
export function guard(req:Request){
 const origin=req.headers.get('origin');const expectedHost=process.env.APP_ORIGIN?new URL(process.env.APP_ORIGIN).host:req.headers.get('host');if(origin&&new URL(origin).host!==expectedHost)throw new Error('跨站写入已拒绝');
 const token=process.env.APP_ACCESS_TOKEN;
 if(process.env.NODE_ENV==='production'&&!token)throw new Error('部署写入未启用：缺少访问口令');
 if(token&&req.headers.get('x-access-token')!==token)throw new Error('访问口令错误');
 // Global budget is deliberately independent of user-controlled forwarding headers.
 const key='write';const now=Date.now();const bucket=attempts.get(key);if(!bucket||bucket.expires<now)attempts.set(key,{count:1,expires:now+60000});else if(++bucket.count>20)throw new Error('操作过于频繁，请一分钟后重试');
}
export async function jsonBody(req:Request){
 if(Number(req.headers.get('content-length')||0)>100000)throw new Error('请求超出大小限制');
 const reader=req.body?.getReader();if(!reader)throw new Error('输入校验失败');
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>100000){await reader.cancel();throw new Error('请求超出大小限制');}chunks.push(value);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function failure(error:unknown){
 if(error instanceof ZodError)return NextResponse.json({error:'输入校验失败',details:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`)},{status:400});
 const known=error instanceof Error&&/拒绝|口令|未启用|频繁|大小|模型|校验|不存在|处理中|配置/.test(error.message);
 return NextResponse.json({error:known?(error as Error).message:'操作失败，请检查输入或服务状态；未发布未经验证的结果'},{status:400});
}
