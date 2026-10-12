import { readFile } from 'node:fs/promises';
export async function modelConfiguration(){
 if(process.env.MODEL_API_KEY&&process.env.MODEL_NAME)return {baseURL:process.env.MODEL_BASE_URL||'https://api.openai.com/v1',apiKey:process.env.MODEL_API_KEY,model:process.env.MODEL_NAME};
 if(process.env.OPENCODE_CONFIG_PATH){
  const config=JSON.parse(await readFile(process.env.OPENCODE_CONFIG_PATH,'utf8'));
  const selected=String(config.model??'');const slash=selected.indexOf('/');const provider=config.provider?.[selected.slice(0,slash)];
  const apiKey=provider?.options?.apiKey;const baseURL=provider?.options?.baseURL;const model=selected.slice(slash+1);
  if(typeof apiKey==='string'&&apiKey&&!apiKey.startsWith('{')&&typeof baseURL==='string'&&model)return {baseURL,apiKey,model};
 }return null;
}
