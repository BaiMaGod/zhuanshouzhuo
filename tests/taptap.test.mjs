import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
installHarness();
const {Save}=await import('../dist/js/storage.js');
const {Core}=await import('../dist/js/model.js');
const {TapPlatform,tapCall}=await import('../dist/js/taptap.js');
const config={appId:'958691',starsBoard:'stars',levelsBoard:'levels',loginUrl:'https://game.example/login',rewardedAdUnitId:'verified-platform-id'};
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
test('login exchanges code then binds account and syncs through Tap filesystem',async()=>{
 const m=mockRuntime(),s=new Save(),p=new TapPlatform(s,false,m.api,config);
 await p.login();assert.equal(p.ready,true);assert.equal(s.owner,'player');
 s.win(10,3,5);await p.sync();assert.equal(s.cloudDirty,false);assert.equal(m.archives.length,1);
 const uploaded=JSON.parse(m.files.get('cloud'));assert.equal(uploaded.owner,'player');assert.equal(uploaded.progress.records[10].stars,3);
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
 const pending=p.rewarded();await assert.rejects(p.rewarded());
 const close=m.close;close({isEnded:true});close({isEnded:true});assert.equal(await pending,true);assert.equal(p.adBusy,false);
 const cancelled=p.rewarded();m.close({isEnded:false});assert.equal(await cancelled,false);
 const missing=p.rewarded();m.close();assert.equal(await missing,false);
 const failed=p.rewarded();m.error({errCode:1});await assert.rejects(failed);assert.equal(p.adBusy,false);
});
test('debug/tainted saves never submit scores, unknown runtime is local only',async()=>{
 const m=mockRuntime(),s=saveFor('debug');s.win(10,1,1);
 const p=new TapPlatform(s,true,m.api,config);p.ready=true;await p.submitScores();assert.equal(m.submissions.length,0);
 const imported=saveFor('unranked');imported.win(10,1,1,false);const q=new TapPlatform(imported,false,m.api,config);q.ready=true;await q.submitScores();assert.equal(m.submissions.length,0);
 imported.win(11,2,2,true);await q.submitScores();assert.equal(m.submissions.length,1);assert.equal(m.submissions[0][0].score,1);
 const local=new TapPlatform(new Save());await local.login();assert.equal(local.ready,false);assert.equal(local.available,false);
});
test('missing login config and failed login never fake an authenticated state',async()=>{
 const m=mockRuntime(),s=saveFor('login-failure');
 const p=new TapPlatform(s,false,m.api,{...config,loginUrl:''});await p.login();assert.equal(p.ready,false);
 m.api.request=o=>o.success({statusCode:401,data:{}});
 const q=new TapPlatform(s,false,m.api,config);await q.login();assert.equal(q.ready,false);assert.equal(s.owner,'login-failure');
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
