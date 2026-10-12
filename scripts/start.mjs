import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','0.0.0.0'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>{process.exit(code??(signal?1:0));});
if(process.env.CLOUD_SMOKE_RUN){
 import('./cloud-smoke.mjs').then(({runCloudSmoke})=>runCloudSmoke()).catch(()=>console.error('CLOUD_SMOKE_RUNNER_FAILED'));
}
