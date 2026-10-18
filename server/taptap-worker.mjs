// Deploy to a fetch-compatible HTTPS worker. This file is never copied to dist.
// Secrets: TAP_MINIAPP_ID, TAP_MINIAPP_SECRET. Public env: ALLOWED_ORIGINS.
export async function handleLogin(request,env,fetcher=fetch){
 const origin=request.headers.get('Origin')||'';
 const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const headers={'content-type':'application/json','cache-control':'no-store','vary':'Origin'};
 if(origin&&!allowed.includes(origin))return new Response('{"error":"origin_not_allowed"}',{status:403,headers});
 if(origin)headers['access-control-allow-origin']=origin;
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(new URL(request.url).pathname!=='/login')return reply({error:'not_found'},404);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'}});
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
 if(!env.TAP_MINIAPP_ID||!env.TAP_MINIAPP_SECRET)return reply({error:'service_not_configured'},503);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'invalid_content_type'},415);
 try{
  // Bounded reader: don't buffer an untrusted, arbitrarily large login body.
  const reader=request.body?.getReader();if(!reader)return reply({error:'invalid_body'},400);
  let text='',size=0;const decoder=new TextDecoder();
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return reply({error:'body_too_large'},413)}text+=decoder.decode(value,{stream:true})}
  text+=decoder.decode();const {code}=JSON.parse(text);
  if(typeof code!=='string'||!code||code.length>2048)return reply({error:'invalid_code'},400);
  const url=new URL('https://cloud-miniapp.tapapis.cn/auth/v1/jscode2session');
  url.search=new URLSearchParams({appid:env.TAP_MINIAPP_ID,secret:env.TAP_MINIAPP_SECRET,js_code:code,grant_type:'authorization_code'}).toString();
  const result=await fetcher(url,{signal:AbortSignal.timeout(10000)});
  if(!result.ok)return reply({error:'platform_unavailable'},502);
  const data=await result.json();
  if(data.errcode||typeof data.openid!=='string'||!data.openid)return reply({error:'invalid_login'},401);
  // Never return session_key or the upstream error body. No credentials are logged.
  return reply({openid:data.openid});
 }catch{return reply({error:'login_failed'},400)}
}
export default {fetch:(request,env)=>handleLogin(request,env)};
