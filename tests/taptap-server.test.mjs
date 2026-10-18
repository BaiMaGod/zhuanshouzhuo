import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLogin} from '../server/taptap-worker.mjs';
const env={TAP_MINIAPP_ID:'test-miniapp',TAP_MINIAPP_SECRET:'server-only-secret',ALLOWED_ORIGINS:'https://game.example'};
const request=(body={code:'once'},origin='https://game.example')=>new Request('https://service.example/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
test('server exchanges credentials only with official endpoint and returns no secret/session key',async()=>{
 const response=await handleLogin(request(),env,async url=>{assert.equal(url.hostname,'cloud-miniapp.tapapis.cn');assert.equal(url.searchParams.get('js_code'),'once');assert.equal(url.searchParams.get('secret'),env.TAP_MINIAPP_SECRET);return Response.json({openid:'verified-player',session_key:'never-return'})});
 assert.deepEqual(await response.json(),{openid:'verified-player'});assert.equal(response.headers.get('cache-control'),'no-store');
});
test('server rejects unapproved origin, missing configuration, invalid code and upstream errors',async()=>{
 assert.equal((await handleLogin(request({},'https://other.example'),env)).status,403);
 assert.equal((await handleLogin(request(),{})).status,403);
 assert.equal((await handleLogin(request(),{ALLOWED_ORIGINS:env.ALLOWED_ORIGINS})).status,503);
 assert.equal((await handleLogin(request({code:''}),env)).status,400);
 const result=await handleLogin(request(),env,async()=>Response.json({errcode:1040029,session_key:'secret'}));
 assert.equal(result.status,401);assert.equal((await result.text()).includes('secret'),false);
});
