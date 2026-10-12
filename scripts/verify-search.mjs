import {writeFile} from 'node:fs/promises';
const r=await fetch('http://127.0.0.1:3000/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'国泰君安 海通证券 换股吸收合并 2024年9月 筹划停牌 公告',start:'2024-09-01',end:'2024-09-30'})});
const d=await r.json();await writeFile('数据接入验证/产品资讯接入实测.json',JSON.stringify({status:r.status,...d},null,2));console.log(JSON.stringify({status:r.status,error:d.error,candidates:d.candidates?.map(c=>({title:c.title,publishedAt:c.publishedAt})),excluded:d.excluded,fetchedAt:d.fetchedAt}));
