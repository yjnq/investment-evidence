import { NextResponse } from 'next/server';
import { withWorkspace } from '@/lib/db';
import { modelConfiguration } from '@/lib/config';
import { failure } from '@/lib/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{const model=await modelConfiguration();return NextResponse.json(await withWorkspace(w=>({...w,tasks:w.tasks.map(t=>({...t,extraction:undefined})),configuration:{model:Boolean(model),database:process.env.DATABASE_URL?'PostgreSQL':'本地持久化 PGlite',writeProtected:Boolean(process.env.APP_ACCESS_TOKEN)}}),false));}catch(e){return failure(e);}}
