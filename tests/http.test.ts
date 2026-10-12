import {describe,it,expect} from 'vitest';
import {jsonBody,guard} from '../src/lib/http';
describe('请求边界',()=>{
 it('兼容反向代理中 Request URL 与浏览器 Host 不同',()=>{expect(()=>guard(new Request('http://localhost:3000/api/demo',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}}))).not.toThrow();});
 it('阻止跨站写入',()=>{expect(()=>guard(new Request('http://localhost:3000/api/demo',{headers:{host:'localhost:3000',origin:'https://attacker.invalid'}}))).toThrow('拒绝');});
 it('拒绝超大实际请求，不依赖声明长度',async()=>{await expect(jsonBody(new Request('http://localhost/',{method:'POST',body:'x'.repeat(100001)}))).rejects.toThrow('大小');});
 it('正常解析中文 JSON',async()=>{await expect(jsonBody(new Request('http://localhost/',{method:'POST',body:JSON.stringify({text:'材料原文'})}))).resolves.toEqual({text:'材料原文'});});
});
