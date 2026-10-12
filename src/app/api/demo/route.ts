import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withWorkspace } from '@/lib/db';
import { applyExtraction,fingerprint,uid,type Material } from '@/lib/domain';
import { fixtures } from '@/lib/fixtures';
import { guard,jsonBody,failure } from '@/lib/http';
export async function POST(req:Request){try{guard(req);const {step}=z.object({step:z.number().int().min(0).max(fixtures.length-1)}).parse(await jsonBody(req));const f=fixtures[step];const result=await withWorkspace(w=>{const fp=fingerprint(f.material);const existing=w.materials.find(m=>m.mode==='fixture'&&m.fingerprint===fp);if(existing)return {message:'该测试材料已处理；未新增版本或通知'};const m:Material={...f.material,id:uid(),fingerprint:fp,fetchedAt:new Date().toISOString(),mode:'fixture',revisionOf:null};w.materials.push(m);const e=applyExtraction(w,m,f.extraction);w.tasks.push({id:uid(),materialId:m.id,status:'success',error:null,model:'人工标注测试夹具（非 AI）',extraction:f.extraction,createdAt:m.fetchedAt,finishedAt:new Date().toISOString()});return {eventId:e.id,message:'构造测试材料已回放；此操作没有调用模型'};});return NextResponse.json(result);}catch(e){return failure(e);}}
