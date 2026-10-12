'use client';
import type {Material,Version,Claim} from '@/lib/domain';
import {earliestKnownSource,evidencePairs,versionChanges} from '@/lib/presentation';
export function EvidenceContext({snapshot,materials,onSource}:{snapshot:Version;materials:Material[];onSource:(id:string)=>void}){
 const earliest=earliestKnownSource(snapshot,materials);
 const pairs=evidencePairs(snapshot.claims);
 return <>
  <div className="origin-strip"><strong>当前已发现的最早披露</strong>{earliest.source?<button onClick={()=>onSource(earliest.source!.id)}>{earliest.source.publishedAt} · {earliest.source.title}</button>:<span>材料缺少已知披露时间，暂不能判断最早来源。</span>}<small>仅比较此版本已获取的材料，不代表全网首发。{earliest.unknownCount>0&&`另有 ${earliest.unknownCount} 份材料披露时间未知。`}</small></div>
  {pairs.length>0&&<section className="conflicts"><h3>变化具体影响了哪条说法</h3>{pairs.map(({response,earlier})=><article key={response.id}><div className="conflict-pair"><div><small>此前陈述</small>{earlier.map(c=><p key={c.id}>{c.text}<span className="badge neutral">{c.status}</span></p>)}</div><div><small>{response.relation==='correct'?'更正证据':'反驳 / 分歧证据'}</small><p>{response.text}<span className="badge warning">{response.status}</span></p><button className="text-button" onClick={()=>onSource(response.materialId)}>核对引用与适用时间 ↗</button></div></div><p className="scope-note">只作用于列出的命题；其他接触、计划或交易条件不自动被否认。</p></article>)}</section>}
 </>;
}
export function VersionDiff({current,previous,onSource}:{current:Version;previous?:Version;onSource:(id:string)=>void}){
 const diff=versionChanges(current,previous);
 return <div className="version-diff">{diff.stage&&<p>业务阶段：{diff.stage.from} → {diff.stage.to}</p>}{diff.changed.map(({claim,from,to})=><button key={claim.id} onClick={()=>onSource(claim.materialId)}><span>{claim.text}</span><small>{from} → {to}</small></button>)}{diff.added.slice(0,3).map(c=><button key={c.id} onClick={()=>onSource(c.materialId)}><span>＋ {c.text}</span><small>{c.status}</small></button>)}{diff.added.length>3&&<small>另有 {diff.added.length-3} 条新增陈述，打开此版本查看全部。</small>}</div>;
}
