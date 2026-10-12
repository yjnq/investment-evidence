import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withWorkspace } from '@/lib/db';
import { guard,jsonBody,failure } from '@/lib/http';
export async function POST(req:Request){try{guard(req);const input=z.object({eventId:z.string(),followed:z.boolean()}).parse(await jsonBody(req));await withWorkspace(w=>{const e=w.events.find(e=>e.id===input.eventId);if(!e)throw new Error('事件不存在');e.followed=input.followed;});return NextResponse.json({ok:true});}catch(e){return failure(e);}}
