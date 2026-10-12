import { NextResponse } from 'next/server';
import { withWorkspace } from '@/lib/db';
import { expireClaims } from '@/lib/domain';
import { guard,failure } from '@/lib/http';
export async function POST(req:Request){try{guard(req);const count=await withWorkspace(w=>expireClaims(w));return NextResponse.json({message:`完成时效检查，${count} 个事件形成新版本`});}catch(e){return failure(e);}}
