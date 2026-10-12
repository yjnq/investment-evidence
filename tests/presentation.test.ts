import {describe,it,expect} from 'vitest';
import {earliestKnownSource,versionChanges,evidencePairs} from '../src/lib/presentation';
import {applyExtraction,emptyWorkspace,fingerprint,type Material} from '../src/lib/domain';
import {fixtures} from '../src/lib/fixtures';
function setup(){const w=emptyWorkspace();for(const i of [2,3]){const f=fixtures[i];const m:Material={...f.material,id:`m${i}`,fingerprint:fingerprint(f.material),mode:'fixture',fetchedAt:'2026-10-12T00:00:00Z',revisionOf:null};w.materials.push(m);applyExtraction(w,m,f.extraction);}return w;}
describe('历史和证据展示',()=>{
 it('旧版本的最早来源不能包含之后才获取的材料',()=>{const w=setup();w.materials.push({...w.materials[0],id:'late',publishedAt:'2020-01-01'});expect(earliestKnownSource(w.events[0].versions[0],w.materials).source?.id).toBe('m2');});
 it('未知披露时间不会被抓取时间替代',()=>{const w=setup();w.materials[0].publishedAt=null;const result=earliestKnownSource(w.events[0].versions[0],w.materials);expect(result.source).toBeNull();expect(result.unknownCount).toBe(1);});
 it('版本差异准确指出被更正旧值与新增证据',()=>{const w=setup();const [a,b]=w.events[0].versions;const diff=versionChanges(b,a);expect(diff.changed[0].claim.key).toBe('price');expect(diff.changed[0].from).toBe('已确认');expect(diff.changed[0].to).toBe('已更正');expect(diff.added[0].key).toBe('correct-price');});
 it('更正证据仅与具体被替换命题配对',()=>{const w=setup();const pair=evidencePairs(w.events[0].versions[1].claims)[0];expect(pair.earlier).toHaveLength(1);expect(pair.earlier[0].key).toBe('price');expect(pair.response.key).toBe('correct-price');});
});
