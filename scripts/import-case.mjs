import {readFile} from 'node:fs/promises';
const root=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
const material=JSON.parse(await readFile(new URL('../data/real-case-csrc.json',import.meta.url),'utf8'));
const r=await fetch(root+'/api/ingest',{method:'POST',headers:{'Content-Type':'application/json','x-access-token':process.env.APP_ACCESS_TOKEN||''},body:JSON.stringify(material)});
console.log(JSON.stringify({status:r.status,result:await r.json()}));
