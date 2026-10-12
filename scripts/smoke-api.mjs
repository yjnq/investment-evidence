const root=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
const r=await fetch(root+'/api/ingest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'【模型验证 · 构造测试】远山科技拟收购远山软件',publisher:'构造测试发布方',sourceType:'anonymous',url:null,originalSource:null,publishedAt:'2026-01-10',occurredAt:null,sourceUpdatedAt:null,text:'以下为虚构测试材料，不对应任何真实公司：远山科技拟收购远山软件控制权，目前双方尚未签署正式协议。市场评论认为交易可能改善协同效率，但整合效果仍不确定。'})});
console.log(JSON.stringify({status:r.status,result:await r.json()}));
