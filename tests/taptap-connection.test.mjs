import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
installHarness();
const {TapPlatform,tapCall}=await import('../dist/js/taptap.js');
const {TapDiagnostics}=await import('../dist/js/taptap-diagnostics.js');
const {Save}=await import('../dist/js/storage.js');
const settle=()=>new Promise(r=>setImmediate(r));
function fixture(){
 let calls=0,reads=0;const auth=[];
 const api={login:o=>{calls++;auth.push(o)},env:{USER_DATA_PATH:'tapfile://usr'},
  getCloudSaveManager:()=>({getArchiveList:o=>{reads++;o.success({saves:[]})}}),getFileSystemManager:()=>({})};
 return {api,auth,get calls(){return calls},get reads(){return reads}};
}
test('native no-callback timeout does not retry or hide a restored cloud archive',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:100000});
 const f=fixture(),p=new TapPlatform(new Save(),false,f.api);
 try{
  await p.start();assert.equal(p.ready,true);assert.equal(p.states.login,'busy');assert.equal(f.reads,1);
  t.mock.timers.tick(125000);await settle();
  assert.equal(p.states.login,'error');assert.equal(p.states.cloud,'ready');assert.match(p.status,/云存档/);
  assert.equal(p.diagnostics[0].code,'CLIENT_TIMEOUT');
  assert.ok(p.trace.events.some(e=>e.phase==='client-timeout'));
  t.mock.timers.tick(300000);await settle();assert.equal(f.calls,1);assert.equal(f.reads,1);
 }finally{p.dispose()}
});
test('manual retry starts one new native call and ignores timed-out native success',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:100000});
 const f=fixture(),p=new TapPlatform(new Save(),false,f.api);
 try{
  await p.start();t.mock.timers.tick(125000);await settle();
  await p.login(true);await p.login(true);assert.equal(f.calls,2);assert.equal(f.reads,1);
  f.auth[0].success({code:'old-sensitive-credential'});assert.equal(p.states.login,'busy');
  f.auth[1].success({code:'new-sensitive-credential'});await settle();assert.equal(p.states.login,'ready');
  const output=p.exportDiagnostics('test');assert.ok(!output.includes('sensitive-credential'));
  assert.ok(p.trace.events.some(e=>e.phase==='late-success'));
 }finally{p.dispose()}
});
test('concurrent cloud requests are deduplicated while native login is pending',async()=>{
 const f=fixture();let answer;
 f.api.getCloudSaveManager=()=>({getArchiveList:o=>{answer=o}});
 const p=new TapPlatform(new Save(),false,f.api);
 try{
  const a=p.start(),b=p.login(true);assert.equal(a,b);assert.equal(f.calls,1);
  answer.success({saves:[]});await a;assert.equal(p.ready,true);assert.equal(p.states.login,'busy');
 }finally{p.dispose()}
});
test('permanent cloud errors stop automatic requests and manual retry can recover',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:100000});
 const f=fixture();let reads=0;
 f.api.login=o=>o.success({code:'once'});
 f.api.getCloudSaveManager=()=>({getArchiveList:o=>{reads++;o.fail({errno:403,errMsg:'permission denied'})}});
 const p=new TapPlatform(new Save(),false,f.api);
 try{
  await p.start();t.mock.timers.tick(60000);await settle();assert.equal(reads,1);assert.equal(p.ready,false);
  f.api.getCloudSaveManager=()=>({getArchiveList:o=>{reads++;o.success({saves:[]})}});
  await p.login(true);assert.equal(reads,2);assert.equal(p.ready,true);
 }finally{p.dispose()}
});
test('transient cloud failure retries at most three times per connection cycle',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:100000});
 const f=fixture();let reads=0;
 f.api.login=o=>o.success({code:'once'});
 f.api.getCloudSaveManager=()=>({getArchiveList:o=>{reads++;o.fail({errno:503})}});
 const p=new TapPlatform(new Save(),false,f.api);
 try{
  await p.start();
  for(const ms of [5000,15000,30000]){t.mock.timers.tick(ms);await settle()}
  assert.equal(reads,4);t.mock.timers.tick(300000);await settle();assert.equal(reads,4);
 }finally{p.dispose()}
});
test('cloud initialization failure can recover after native login without a second native call',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:100000});
 const f=fixture();let reads=0;
 f.api.getCloudSaveManager=()=>({getArchiveList:o=>{reads++;if(reads===1)o.fail({errno:400100});else o.success({saves:[]})}});
 const p=new TapPlatform(new Save(),false,f.api);
 try{
  await p.start();assert.equal(p.ready,false);f.auth[0].success({code:'once'});await settle();
  assert.equal(p.ready,true);assert.equal(reads,2);assert.equal(f.calls,1);
 }finally{p.dispose()}
});
test('empty login success is not reported as a valid login credential',async()=>{
 const p=new TapPlatform(new Save(),false,{login:o=>o.success({})});
 try{await p.start();assert.equal(p.states.login,'error');assert.equal(p.diagnostics[0].code,'INVALID_LOGIN_RESPONSE')}
 finally{p.dispose()}
});
test('complete without success/fail is diagnostic evidence and does not mark login successful',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:100000});
 const log=new TapDiagnostics(),task=tapCall({login:o=>o.complete({code:'never-log-this'})},'login',{},false,100,{log,capability:'login'});
 const rejected=assert.rejects(task,e=>e.code==='CLIENT_TIMEOUT');
 assert.ok(log.events.some(e=>e.phase==='complete-without-result'));t.mock.timers.tick(100);await rejected;
 assert.ok(!log.export('test',{}).includes('never-log-this'));
});
test('disposing a pending restore prevents late data changes and upload',async()=>{
 const f=fixture();let answer;
 f.api.getCloudSaveManager=()=>({getArchiveList:o=>{answer=o}});
 const save=new Save(),p=new TapPlatform(save,false,f.api);
 const task=p.start();const owner=save.owner;p.dispose();await task;
 answer.success({saves:[]});f.auth[0].success({code:'late'});await settle();
 assert.equal(p.ready,false);assert.equal(save.owner,owner);assert.equal(p.diagnostics.length,0);
});
test('diagnostics redact credentials from native errors and omit page query parameters',async()=>{
 const log=new TapDiagnostics(),id=log.begin('login','login');
 log.record(id,'fail',{errno:401,errMsg:'https://example.test?code=login-secret-ABC&token=token-secret-DEF session_key:session-secret-GHI openid=owner-secret-JKL'});log.finish(id);
 const output=log.export('0.15.4',{});for(const value of ['login-secret-ABC','token-secret-DEF','session-secret-GHI','owner-secret-JKL'])assert.ok(!output.includes(value));
 assert.ok(output.includes('[redacted]'));assert.ok(output.includes('0.15.4'));
});
