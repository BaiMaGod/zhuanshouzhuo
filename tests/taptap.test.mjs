import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
installHarness();
const {Save}=await import('../dist/js/storage.js');
const {Core}=await import('../dist/js/model.js');
const {TapPlatform,tapCall}=await import('../dist/js/taptap.js');
const config={appId:'958691',starsBoard:'stars',levelsBoard:'levels',rewardedAdUnitId:'verified-platform-id'};
test('compiled default configuration reaches the rewarded SDK without a login dependency',async()=>{
 let options,close;
 const platform=new TapPlatform(new Save(),false,{createRewardedVideoAd:value=>{
  options=value;
  return{load:async()=>{},show:async()=>{},onClose:fn=>{close=fn},onError:()=>{}};
 }});
 assert.equal(platform.adsAvailable,true);
 const result=platform.rewarded();
 assert.deepEqual(options,{adUnitId:'1054324'});
 close({isEnded:true});assert.equal(await result,true);platform.dispose();
});
const saveFor=id=>{const save=new Save();save.bindAccount(id);return save};
function mockRuntime(){
 const files=new Map(),archives=[];let close,error,shows=0,submissions=[];
 const api={env:{USER_DATA_PATH:'tapfile://usr'},
  login:o=>o.success({code:'one-time-code'}),request:o=>o.success({statusCode:200,data:{openid:'player'}}),
  getFileSystemManager:()=>({writeFile:o=>{files.set(o.filePath,o.data);o.success({})},readFile:o=>o.success({data:files.get(o.filePath)})}),
  getCloudSaveManager:()=>({getArchiveList:o=>o.success({saves:archives}),createArchive:o=>{archives.push({name:o.archiveMetaData.name,uuid:'slot',fileId:'file'});files.set('cloud',files.get(o.archiveFilePath));o.success({uuid:'slot',fileId:'file'})},updateArchive:o=>{files.set('cloud',files.get(o.archiveFilePath));o.success({uuid:'slot',fileId:'file2'})},getArchiveData:o=>{files.set(o.targetFilePath,files.get('cloud'));o.success({filePath:o.targetFilePath})}}),
  getLeaderboardManager:()=>({submitScores:o=>{submissions.push(o.scores);o.callback.onSuccess({})},openLeaderboard:o=>o.callback.onSuccess({})}),
  createRewardedVideoAd:()=>({load:async()=>{},show:async()=>{shows++},onClose:f=>{close=f},offClose:f=>{if(close===f)close=null},onError:f=>{error=f},offError:f=>{if(error===f)error=null}})};
 return {api,files,archives,submissions,get shows(){return shows},get close(){return close},get error(){return error}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('automatic startup waits for native login longer than 15 seconds before reading cloud',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:3000000});
 const m=mockRuntime();let loginOptions,authenticated=false,reads=0;
 m.api.login=o=>{loginOptions=o};
 const cloud=m.api.getCloudSaveManager;
 m.api.getCloudSaveManager=()=>({...cloud(),getArchiveList:o=>{reads++;assert.equal(authenticated,true);cloud().getArchiveList(o)}});
 const p=new TapPlatform(new Save(),false,m.api,config),pending=p.start();
 assert.equal(loginOptions.timeout,120000);assert.equal(reads,0);
 t.mock.timers.tick(16000);await settle();
 assert.equal(p.states.login,'busy');assert.equal(reads,0);assert.equal(p.diagnostics.length,0);
 authenticated=true;loginOptions.success({code:'do-not-store-this'});await pending;
 assert.equal(p.states.login,'ready');assert.equal(p.ready,true);assert.equal(reads,1);p.dispose();
});
test('failed automatic login and cloud read retry themselves and later progress uploads automatically',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:4000000});
 const m=mockRuntime();let attempts=0,reads=0;
 m.api.login=o=>++attempts===1?o.fail({errno:1040029,errMsg:'temporary login error'}):o.success({code:'once'});
 const cloud=m.api.getCloudSaveManager;
 m.api.getCloudSaveManager=()=>({...cloud(),getArchiveList:o=>++reads===1?o.fail({errCode:503}):cloud().getArchiveList(o)});
 const save=new Save(),p=new TapPlatform(save,false,m.api,config);save.onChange=()=>p.localChanged();
 await p.start();assert.equal(p.states.login,'error');assert.equal(p.ready,false);
 assert.equal(p.diagnostics.find(d=>d.capability==='login').code,'1040029');
 t.mock.timers.tick(4999);await settle();assert.equal(attempts,1);
 t.mock.timers.tick(1);await settle();assert.equal(attempts,2);assert.equal(reads,2);assert.equal(p.ready,true);
 save.win(34,2,3);t.mock.timers.tick(0);await settle();
 assert.equal(save.cloudDirty,false);assert.equal(m.archives.length,1);assert.equal(save.owner,'archive:slot');p.dispose();
});
test('late global bridge and late cloud capability are discovered without a manual click',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:5000000});
 const previous=globalThis.tap;delete globalThis.tap;
 const p=new TapPlatform(new Save());
 try{
  await p.start();assert.equal(p.available,false);
  const m=mockRuntime();let logins=0;m.api.login=o=>{logins++;o.success({code:'once'})};delete m.api.env.USER_DATA_PATH;
  globalThis.tap=m.api;t.mock.timers.tick(500);await settle();
  assert.equal(p.states.login,'ready');assert.equal(p.ready,false);assert.equal(logins,1);
  m.api.env.USER_DATA_PATH='tapfile://usr';t.mock.timers.tick(500);await settle();
  assert.equal(p.ready,true);assert.equal(logins,1);assert.match(p.save.owner,/^session:/);
 }finally{p.dispose();if(previous===undefined)delete globalThis.tap;else globalThis.tap=previous}
});
test('deferred automatic restore resumes on home without repeated cloud reads during gameplay',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:6000000});
 const m=mockRuntime(),remote=saveFor('auto-restore');remote.win(35,2,4);
 m.archives.push({name:'jade_save_v1',uuid:'auto-slot',fileId:'file'});m.files.set('cloud',JSON.stringify(remote.exportCloud()));
 const cloud=m.api.getCloudSaveManager;let reads=0;
 m.api.getCloudSaveManager=()=>({...cloud(),getArchiveList:o=>{reads++;cloud().getArchiveList(o)}});
 const p=new TapPlatform(new Save(),false,m.api,config);p.canRestore=()=>false;
 await p.start();t.mock.timers.tick(1000);await settle();
 assert.equal(reads,0);assert.equal(p.ready,false);assert.equal(p.save.data.records[35],undefined);
 p.canRestore=()=>true;t.mock.timers.tick(1000);await settle();
 assert.equal(reads,1);assert.equal(p.ready,true);assert.equal(p.save.data.records[35].stars,3);p.dispose();
});
test('foreground reconnect is deduplicated and successful login is not repeated',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:7000000});
 const m=mockRuntime();let logins=0,reads=0,recover;
 m.api.login=o=>{logins++;o.success({code:'once'})};
 const cloud=m.api.getCloudSaveManager;
 m.api.getCloudSaveManager=()=>({...cloud(),getArchiveList:o=>{reads++;if(reads===1)o.fail({errCode:503});else recover=()=>cloud().getArchiveList(o)}});
 const p=new TapPlatform(new Save(),false,m.api,config);await p.start();
 const a=p.resume(),b=p.resume();assert.equal(a,b);await settle();assert.equal(logins,1);assert.equal(reads,2);
 recover();await a;assert.equal(p.ready,true);p.dispose();
 t.mock.timers.tick(120000);await settle();assert.equal(reads,2);
});
test('account keys isolate guest and different TapTap players',()=>{
 const s=new Save();s.win(10,1,2);s.bindAccount('a');assert.equal(s.data.records[10],undefined);
 s.win(11,2,2);s.bindAccount('b');assert.equal(s.data.records[11],undefined);
 s.bindAccount('a');assert.equal(s.data.records[11].steps,2);
 assert.equal(new Save().data.records[10].stars,3);
});
test('each reward can be claimed once per run; reload or clearing board alone preserves claim',()=>{
 const s=saveFor('rewards');assert.equal(s.claim(10,'hint'),true);assert.equal(s.claim(10,'hint'),false);
 assert.equal(s.claim(10,'erase'),true);s.clearRun(10);assert.equal(s.canClaim(10,'hint'),false);
 assert.equal(saveFor('rewards').rewardLeft(10,'hint'),1);
 const stale=s.exportCloud();s.consumeReward(10,'hint');s.mergeCloud(stale);
 assert.equal(s.rewardLeft(10,'hint'),0);assert.equal(s.rewardLeft(10,'erase'),1);
 assert.equal(s.canClaim(11,'hint'),true);
});
test('cloud validation rejects foreign account, bad score and malformed board before changes',()=>{
 const s=saveFor('validate'),original=s.exportCloud();
 assert.throws(()=>s.mergeCloud({...original,owner:'other'}));
 const bad=structuredClone(original);bad.progress.records[10]={steps:-1,stars:99};assert.throws(()=>s.mergeCloud(bad));
 const badRun=structuredClone(original);badRun.runs[10]={state:{}};assert.throws(()=>s.mergeCloud(badRun));
 assert.deepEqual(s.exportCloud(),original);
});
test('different whole-board saves require conflict choice; records merge safely',()=>{
 const s=saveFor('conflict');s.writeRun(10,Core.make(10),1,1);
 const cloud=s.exportCloud();cloud.runs[10].hint=0;cloud.progress.records[11]={steps:5,stars:2};
 assert.equal(s.hasRunConflict(cloud),true);s.mergeCloud(cloud,false);assert.equal(s.readRun(10).hint,1);
 s.mergeCloud(cloud,true);assert.equal(s.readRun(10).hint,0);assert.equal(s.data.records[11].stars,2);
});
test('container login needs no login server, then writes and uploads through Tap filesystem',async()=>{
 const m=mockRuntime(),s=new Save(),p=new TapPlatform(s,false,m.api,config);
 await p.login();assert.equal(p.ready,true);assert.match(s.owner,/^session:/);
 s.win(10,3,5);await p.sync();assert.equal(s.cloudDirty,false);assert.equal(m.archives.length,1);
 const uploaded=JSON.parse(m.files.get('cloud'));assert.match(uploaded.owner,/^session:/);assert.equal(s.owner,'archive:slot');assert.equal(uploaded.progress.records[10].stars,3);
 assert.deepEqual(m.submissions[0],[{leaderboardId:'levels',score:1},{leaderboardId:'stars',score:3}]);
 s.win(11,2,5);await p.sync();assert.equal(s.cloudDirty,true);assert.equal(m.archives.length,1);
});
test('upload while local data changes leaves new revision pending',async()=>{
 const m=mockRuntime(),s=saveFor('race'),p=new TapPlatform(s,false,m.api,config);p.ready=true;
 s.persist();const original=m.api.getFileSystemManager;
 m.api.getFileSystemManager=()=>({...original(),writeFile:o=>{s.win(12,1,1);original().writeFile(o)}});
 await p.sync();assert.equal(s.cloudDirty,true);
});
test('only explicit complete event rewards, duplicate callbacks settle once, errors unlock',async()=>{
 const m=mockRuntime(),p=new TapPlatform(saveFor('ad'),false,m.api,config);p.ready=true;
 const pending=p.rewarded();assert.equal(await p.rewarded(),null);
 const close=m.close;close({isEnded:true});close({isEnded:true});assert.equal(await pending,true);assert.equal(p.adBusy,false);
 const cancelled=p.rewarded();m.close({isEnded:false});assert.equal(await cancelled,false);
 const missing=p.rewarded();m.close();assert.equal(await missing,false);
 const failed=p.rewarded();m.error({errCode:1});assert.equal(await failed,null);assert.equal(p.adBusy,false);
});
test('debug/tainted saves never submit scores, unknown runtime is local only',async()=>{
 const m=mockRuntime(),s=saveFor('debug');const p=new TapPlatform(s,true,m.api,config);p.ready=true;s.win(10,1,1);await p.submitScores();assert.equal(m.submissions.length,0);
 const imported=saveFor('unranked');const q=new TapPlatform(imported,false,m.api,config);q.ready=true;imported.win(10,1,1,false);await q.submitScores();assert.equal(m.submissions.length,0);
 imported.win(11,2,2,true);await q.submitScores();assert.equal(m.submissions.length,1);assert.equal(m.submissions[0][0].score,1);
 const local=new TapPlatform(new Save());await local.login();assert.equal(local.ready,false);assert.equal(local.available,false);
});
test('failed login and cloud restore cannot block boards or advertisements',async()=>{
 const m=mockRuntime(),p=new TapPlatform(new Save(),false,m.api,config);
 m.api.login=o=>o.fail({errCode:401,errMsg:'login failed'});
 m.api.getCloudSaveManager=()=>({getArchiveList:o=>o.fail({errCode:503})});
 await p.login();assert.equal(p.states.login,'error');assert.equal(p.ready,false);
 assert.equal(await p.openBoard(),true);const ad=p.rewarded();m.close({isEnded:true});assert.equal(await ad,true);
 assert.deepEqual(p.diagnostics.map(d=>d.capability).sort(),['cloud','login']);
 p.dispose();
});
test('callback and Promise cannot resolve the same platform operation twice',async()=>{
 assert.equal(await tapCall({double:o=>{o.success(1);return Promise.resolve(2)}},'double'),1);
 await assert.rejects(tapCall({},'absent'));
});

test('explicit restart resets both ad quotas and stale cloud claims cannot undo reset',()=>{
 const s=saveFor('restart-generation');s.claim(10,'hint');s.claim(10,'erase');const stale=s.exportCloud();
 s.resetRewards(10);assert.equal(s.canClaim(10,'hint'),true);assert.equal(s.canClaim(10,'erase'),true);
 assert.equal(s.rewardLeft(10,'hint'),0);s.mergeCloud(stale);assert.equal(s.canClaim(10,'hint'),true);
 const reset=s.exportCloud();s.claim(10,'hint');s.mergeCloud(reset);assert.equal(s.canClaim(10,'hint'),false);
 const again=saveFor('restart-generation');assert.equal(again.canClaim(10,'hint'),false);
});

test('capabilities are detected separately and incomplete runtime hides unavailable entries',async()=>{
 const p=new TapPlatform(new Save(),false,{login:o=>o.success({})},{...config,rewardedAdUnitId:''});
 assert.equal(p.capabilities.login,true);assert.equal(p.capabilities.cloud,false);
 assert.equal(p.boardAvailable(),false);assert.equal(p.adsAvailable,false);
 assert.equal(await p.openBoard(),false);assert.equal(await p.rewarded(),null);await p.login();
 assert.equal(p.states.login,'ready');assert.equal(p.ready,false);
 const m=mockRuntime();delete m.api.env.USER_DATA_PATH;
 const q=new TapPlatform(new Save(),false,m.api,config);assert.equal(q.capabilities.cloud,false);assert.equal(q.boardAvailable(),true);
});

test('launch reporting is once-only, integer, nonnegative and independent of login',async()=>{
 const calls=[],p=new TapPlatform(new Save(),false,{reportScene:o=>{calls.push(o);o.success({})}},config);
 await p.reportReady(12.8);await p.reportReady(999);
 assert.equal(calls.length,1);assert.equal(calls[0].sceneId,7);assert.equal(calls[0].costTime,13);
 const q=new TapPlatform(new Save(),false,{reportScene:o=>{assert.equal(o.costTime,0);o.fail({errCode:1})}},config);
 await q.reportReady(-2);assert.equal(q.states.report,'error');
});

test('cloud restore uses latest container-owned slot and migrates a legacy owner safely',async()=>{
 const m=mockRuntime(),cloud=saveFor('legacy-server-player');cloud.win(17,3,4);
 m.archives.push({name:'jade_save_v1',uuid:'older',fileId:'old',modifiedTime:10},{name:'jade_save_v1',uuid:'latest',fileId:'new',modifiedTime:20});
 m.files.set('cloud',JSON.stringify(cloud.exportCloud()));let downloaded;
 const original=m.api.getCloudSaveManager;
 m.api.getCloudSaveManager=()=>({...original(),getArchiveData:o=>{downloaded=o.archiveUUID;original().getArchiveData(o)}});
 const s=new Save(),p=new TapPlatform(s,false,m.api,config);await p.login();
 assert.equal(downloaded,'latest');assert.equal(p.ready,true);assert.equal(s.owner,'archive:latest');assert.equal(s.data.records[17].stars,3);
 assert.equal(m.archives.length,2);p.dispose();
});

test('same-device different container accounts cannot automatically share progress',async()=>{
 const m=mockRuntime(),s=new Save(),p=new TapPlatform(s,false,m.api,config);await p.login();s.win(21,2,4);await p.sync();p.dispose();
 const n=mockRuntime(),next=new Save(),q=new TapPlatform(next,false,n.api,config);await q.login();
 assert.equal(next.data.records[21],undefined);assert.equal(n.submissions.length,0);
 assert.equal(next.hasRecoveryProgress(),true);next.importRecovery();
 assert.ok(Object.keys(next.data.records).length>0);assert.deepEqual(next.rankRecords,{});q.dispose();
});

test('malformed remote never replaces local progress or enables an overwrite',async()=>{
 const m=mockRuntime(),s=new Save(),p=new TapPlatform(s,false,m.api,config);s.win(24,2,4);
 const owner=s.owner,bad=s.exportCloud();bad.progress.records[24].stars=99;
 m.archives.push({name:'jade_save_v1',uuid:'broken',fileId:'file'});m.files.set('cloud',JSON.stringify(bad));
 await p.login();assert.equal(p.ready,false);assert.equal(s.owner,owner);assert.equal(s.data.records[24].stars,3);
 await p.sync();assert.equal(m.files.get('cloud'),JSON.stringify(bad));assert.equal(await p.openBoard(),true);p.dispose();
});

test('restoration waits for a safe scene and preserves progress earned while downloading',async()=>{
 const m=mockRuntime(),remote=saveFor('deferred');remote.win(25,3,4);
 m.archives.push({name:'jade_save_v1',uuid:'deferred',fileId:'file'});m.files.set('cloud',JSON.stringify(remote.exportCloud()));
 const s=new Save(),p=new TapPlatform(s,false,m.api,config);p.canRestore=()=>false;s.win(26,2,3);
 await p.login();assert.equal(s.data.records[25],undefined);assert.equal(p.ready,false);
 p.canRestore=()=>true;await p.login();assert.equal(s.data.records[25].stars,3);assert.equal(s.data.records[26].stars,3);p.dispose();
});

test('cloud uploads coalesce at 65 seconds and retry updates without creating a duplicate slot',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:1000000});
 const m=mockRuntime(),s=new Save(),p=new TapPlatform(s,false,m.api,config);await p.login();
 s.win(30,2,3);await p.sync();assert.equal(s.cloudDirty,false);assert.equal(m.archives.length,1);
 s.win(31,2,3);p.localChanged();await p.sync();assert.equal(s.cloudDirty,true);
 t.mock.timers.tick(64999);await p.sync();assert.equal(s.cloudDirty,true);
 t.mock.timers.tick(1);await p.sync();assert.equal(s.cloudDirty,false);assert.equal(m.archives.length,1);
 const original=m.api.getCloudSaveManager;let fail=true,updates=0;
 m.api.getCloudSaveManager=()=>({...original(),updateArchive:o=>{updates++;assert.equal(o.archiveUUID,'slot');if(fail)o.fail({errCode:503});else original().updateArchive(o)}});
 s.win(32,2,3);p.localChanged();t.mock.timers.tick(65000);await p.sync();assert.equal(s.cloudDirty,true);
 fail=false;t.mock.timers.tick(65000);await p.sync();assert.equal(s.cloudDirty,false);assert.equal(updates,2);assert.equal(m.archives.length,1);p.dispose();
});

test('ranking works without cloud or login and submits only improved absolute records',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:2000000});
 const m=mockRuntime(),s=new Save(),p=new TapPlatform(s,false,{getLeaderboardManager:m.api.getLeaderboardManager},config);
 s.win(33,100,1);await p.submitScores();assert.deepEqual(m.submissions[0],[{leaderboardId:'levels',score:1},{leaderboardId:'stars',score:1}]);
 t.mock.timers.tick(65000);s.win(33,1,1);await p.submitScores();assert.deepEqual(m.submissions[1],[{leaderboardId:'stars',score:3}]);
 t.mock.timers.tick(65000);s.win(33,100,1);await p.submitScores();assert.equal(m.submissions.length,2);p.dispose();
});

test('ad show retries a load once; inventory errors are retained and never grant rewards',async()=>{
 let close,shows=0,loads=0,fail;
 const ad={show:async()=>{if(++shows===1)throw Error('not loaded')},load:async()=>{loads++},onClose:f=>{close=f},onError:f=>{fail=f}};
 const p=new TapPlatform(new Save(),false,{createRewardedVideoAd:()=>ad},config);
 const reward=p.rewarded();await new Promise(r=>setImmediate(r));assert.equal(shows,2);assert.equal(loads,1);close({isEnded:true});assert.equal(await reward,true);
 const noInventory=p.rewarded();fail({errCode:1004,errMsg:'no inventory'});assert.equal(await noInventory,null);
 assert.match(p.errorMessage('ads'),/暂无/);assert.equal(p.adBusy,false);p.dispose();
});
