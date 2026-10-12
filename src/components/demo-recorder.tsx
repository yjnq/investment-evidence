'use client';
import {useEffect,useRef,useState} from 'react';
const scenes=[
 ['真实事件：核准，不等于完成','国泰君安—海通证券案例。当前结论逐条引用证据，不输出买卖建议。',12],
 ['原文与时间，分别保存','发生时间、披露时间、导入时间、来源更新时间分别展示；未知日期留空。',14],
 ['晚发现的旧线索，归入同一事件','真实GPT将历史候选片段归入已有交易，保留审批阶段与此前版本。',14],
 ['回到当时的判断','V1只包含当时已获取的材料，不使用后来证据改写过去。',12],
 ['构造测试：部分否认与金额更正','以下为虚构公司测试案例。否认只影响对应说法；10亿元更正为9亿元。',16],
 ['构造测试：过期不等于虚假','版本差异指出新增陈述及状态变化。预测到期失效，不代表交易终止。',14],
 ['关注变化，通知有据可查','真实材料归并与测试版本更新均形成通知；重复输入不重复通知。',12],
 ['异常可见，材料可重试','真实模型处理记录保留成功与失败。关键数字、引用、历史判断均可追溯。',12],
] as const;
const total=scenes.reduce((n,s)=>n+s[2],0);
export default function DemoRecorder({ready,onScene}:{ready:boolean;onScene:(scene:number)=>void}){
 const callback=useRef(onScene);callback.current=onScene;
 const [mode,setMode]=useState<'idle'|'preview'|'recording'|'done'>('idle'),[scene,setScene]=useState(0),[seconds,setSeconds]=useState(0),[message,setMessage]=useState(''),[download,setDownload]=useState(''),[filename,setFilename]=useState('');
 const timer=useRef<ReturnType<typeof setInterval>|null>(null),recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),start=useRef(0);
 useEffect(()=>()=>{if(timer.current)clearInterval(timer.current);stream.current?.getTracks().forEach(t=>t.stop());},[]);
 function run(record:boolean){
  setScene(0);setSeconds(0);callback.current(0);start.current=Date.now();setMode(record?'recording':'preview');
  let last=0;
  timer.current=setInterval(()=>{const elapsed=(Date.now()-start.current)/1000;setSeconds(Math.floor(elapsed));let bound=0,index=scenes.length-1;for(let i=0;i<scenes.length;i++){bound+=record?scenes[i][2]:2;if(elapsed<bound){index=i;break;}}if(index!==last){last=index;setScene(index);callback.current(index);}if(elapsed>=(record?total:scenes.length*2)){if(timer.current)clearInterval(timer.current);if(record&&recorder.current?.state==='recording')recorder.current.stop();setMode('done');if(!record)setMessage('加速预览完成：8个实际产品视图已自动切换。');}},150);
 }
 async function record(){
  try{
   setMessage('请选择共享当前“知序”标签页。共享成功后自动开始演示，无需手动切换。');
   const s=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:15},audio:false,...{preferCurrentTab:true,systemAudio:'exclude',monitorTypeSurfaces:'exclude'}});stream.current=s;
   const mime=['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
   const r=new MediaRecorder(s,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:3500000});recorder.current=r;const chunks:BlobPart[]=[];
   r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   r.onstop=()=>{s.getTracks().forEach(t=>t.stop());const type=r.mimeType,ext=type.includes('mp4')?'mp4':'webm';const name=`知序_产品演示_${total}秒.${ext}`;const blob=new Blob(chunks,{type});const url=URL.createObjectURL(blob);setDownload(url);setFilename(name);setMessage(`录制完成，实际时长约${Math.round((Date.now()-start.current)/1000)}秒。请下载后检查。`);const a=document.createElement('a');a.href=url;a.download=name;a.click();};
   s.getVideoTracks()[0].onended=()=>{if(r.state==='recording'){r.stop();if(timer.current)clearInterval(timer.current);setMode('done');}};
   setMessage('');r.start(1000);run(true);
  }catch(e){setMessage(`未开始录制：${e instanceof Error?e.name:'无法取得录屏权限'}`);}
 }
 const active=mode==='preview'||mode==='recording';
 return <>{!active&&<div className="demo-recorder-controls"><strong>提交演示 · 真实线上数据</strong><button disabled={!ready} onClick={()=>run(false)}>验证自动操作（16秒）</button><button disabled={!ready} onClick={record}>录制{total}秒演示</button>{download&&<a href={download} download={filename}>下载视频</a>}<small>{message||'此工具仅自动导航现有页面，不改写材料、版本或测试结果。'}</small></div>}{active&&<div className="demo-caption"><span>{scene+1} / {scenes.length} · {mode==='recording'?'真实产品录屏':'自动操作预览'} · {seconds}秒</span><strong>{scenes[scene][0]}</strong><p>{scenes[scene][1]}</p><div style={{width:`${Math.min(100,seconds/(mode==='recording'?total:16)*100)}%`}}/></div>}</>;
}
