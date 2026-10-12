import { NextResponse } from 'next/server';
import { withWorkspace } from '@/lib/db';
import { materialSchema,fingerprint,uid,applyExtraction,type Material,type Task } from '@/lib/domain';
import { extract,ModelError } from '@/lib/model';
import { modelConfiguration } from '@/lib/config';
import { guard,jsonBody,failure } from '@/lib/http';
export const runtime='nodejs';
export const maxDuration=90;
export async function POST(req:Request){
 try{
  guard(req);const modelConfig=await modelConfiguration();const input=materialSchema.parse(await jsonBody(req));
  const prepared=await withWorkspace(w=>{
   const now=new Date().toISOString();const fp=fingerprint(input);let material=w.materials.find(m=>m.fingerprint===fp&&m.mode==='live');
   if(material&&w.tasks.some(t=>t.materialId===material!.id&&t.status==='success'))return {duplicate:true as const};
   const pending=material&&w.tasks.find(t=>t.materialId===material!.id&&t.status==='processing');
   if(pending&&Date.now()-Date.parse(pending.createdAt)<120000)throw new Error('该材料正在处理中');
   if(pending){pending.status='failed';pending.error='上次处理被中断，可重试';pending.finishedAt=now;}
   if(!material){material={...input,id:uid(),fingerprint:fp,fetchedAt:now,mode:'live',revisionOf:input.url?w.materials.find(m=>m.url===input.url&&m.mode==='live')?.id??null:null} satisfies Material;w.materials.push(material);}
   const task:Task={id:uid(),materialId:material.id,status:'processing',error:null,model:modelConfig?.model??null,createdAt:now,finishedAt:null,extraction:null};w.tasks.push(task);
   return {duplicate:false as const,material,task,events:w.events};
  });
  if(prepared.duplicate)return NextResponse.json({duplicate:true,message:'重复材料已忽略，没有新增版本或通知'});
  try{
   const extraction=await extract(prepared.material,prepared.events);
   const eventId=await withWorkspace(w=>{const event=applyExtraction(w,prepared.material,extraction);const task=w.tasks.find(t=>t.id===prepared.task.id)!;Object.assign(task,{status:'success',extraction,finishedAt:new Date().toISOString()});return event.id;});
   return NextResponse.json({eventId,message:'材料已处理，证据与版本已保存'});
  }catch(error){const message=error instanceof ModelError?error.message:'处理校验失败；保留材料，未发布版本';await withWorkspace(w=>{const task=w.tasks.find(t=>t.id===prepared.task.id)!;Object.assign(task,{status:'failed',error:message,finishedAt:new Date().toISOString()});});return NextResponse.json({error:message},{status:422});}
 }catch(e){return failure(e);}
}
