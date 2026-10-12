import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleLite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { materialsTable,eventsTable,tasksTable,noticesTable } from './schema';
import type { Workspace } from './domain';
import { mkdir } from 'node:fs/promises';
const globalDb=globalThis as unknown as {evidenceDb?:Promise<ReturnType<typeof drizzleLite>|ReturnType<typeof drizzlePostgres>>; evidenceQueue?:Promise<unknown>};
async function database(){
 if(!globalDb.evidenceDb)globalDb.evidenceDb=(async()=>{
  if(process.env.NODE_ENV==='production'&&!process.env.DATABASE_URL&&process.env.ALLOW_LOCAL_DB!=='true')throw new Error('部署模式必须配置 PostgreSQL DATABASE_URL');
  let db:ReturnType<typeof drizzleLite>|ReturnType<typeof drizzlePostgres>;
  if(process.env.DATABASE_URL)db=drizzlePostgres(postgres(process.env.DATABASE_URL,{max:5,connect_timeout:10}));
  else{await mkdir('.data',{recursive:true});db=drizzleLite(new PGlite('.data/evidence'));}
  for(const table of ['materials','events','tasks','notices'])await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ${table} (id text PRIMARY KEY, payload jsonb NOT NULL)`));
  return db;
 })();
 return globalDb.evidenceDb;
}
export async function withWorkspace<T>(fn:(w:Workspace)=>T|Promise<T>,write=true):Promise<T>{
 const run=async()=>{
  const db=await database();
  return db.transaction(async tx=>{
   // A DB-level lock serializes writers across Node instances, not only this process.
   if(process.env.DATABASE_URL)await tx.execute(sql`SELECT pg_advisory_xact_lock(81724012)`);
   const w:Workspace={materials:(await tx.select().from(materialsTable)).map(r=>r.payload),events:(await tx.select().from(eventsTable)).map(r=>r.payload),tasks:(await tx.select().from(tasksTable)).map(r=>r.payload),notices:(await tx.select().from(noticesTable)).map(r=>r.payload)};
   const result=await fn(w);
   if(write){
    for(const row of w.materials)await tx.insert(materialsTable).values({id:row.id,payload:row}).onConflictDoUpdate({target:materialsTable.id,set:{payload:row}});
    for(const row of w.events)await tx.insert(eventsTable).values({id:row.id,payload:row}).onConflictDoUpdate({target:eventsTable.id,set:{payload:row}});
    for(const row of w.tasks)await tx.insert(tasksTable).values({id:row.id,payload:row}).onConflictDoUpdate({target:tasksTable.id,set:{payload:row}});
    for(const row of w.notices)await tx.insert(noticesTable).values({id:row.id,payload:row}).onConflictDoUpdate({target:noticesTable.id,set:{payload:row}});
   }return result;
  });
 };
 const result=(globalDb.evidenceQueue??Promise.resolve()).then(run,run);globalDb.evidenceQueue=result.catch(()=>{});return result;
}
