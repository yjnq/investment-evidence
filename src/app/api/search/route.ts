import { NextResponse } from 'next/server';
import { searchNotices,searchSchema } from '@/lib/ifind';
import { guard,jsonBody,failure } from '@/lib/http';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(req:Request){try{guard(req);return NextResponse.json(await searchNotices(searchSchema.parse(await jsonBody(req))));}catch(e){return failure(e);}}
