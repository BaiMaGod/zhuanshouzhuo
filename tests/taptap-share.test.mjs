import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
const h=installHarness();
const {Save}=await import('../dist/js/storage.js');
const {TapPlatform}=await import('../dist/js/taptap.js');
const config={shareTemplateId:'approved-share-template',rewardedAdUnitId:'test-ad',levelsBoard:'levels',starsBoard:'stars'};
function sharing(){
 let listener,panel,off=0;
 const api={onShareMessage:o=>{listener=o},offShareMessage:()=>{off++},showShareboard:o=>{panel=o;o.success({})},getLeaderboardManager:()=>({openLeaderboard:o=>o.callback.onSuccess({})})};
 return {api,get listener(){return listener},get panel(){return panel},get off(){return off}};
}
test('opening share panel never grants; actual share callback settles once and cleans up',async()=>{
 const m=sharing(),p=new TapPlatform(new Save(),false,m.api,config);
 let settled=false;const pending=p.shareReward('scene');pending.then(()=>settled=true);
 await Promise.resolve();assert.equal(settled,false);assert.equal(m.panel.templateId,config.shareTemplateId);
 assert.equal(await p.shareReward('duplicate'),null);
 m.listener.success({channel:'wechat'});m.listener.success({channel:'wechat'});
 assert.equal(await pending,true);assert.equal(m.off,1);assert.equal(p.shareBusy,false);p.dispose();
});
test('cancel, sheet failure, timeout, disposal and stale callbacks do not grant',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const m=sharing(),p=new TapPlatform(new Save(),false,m.api,config);
 let pending=p.shareReward('');m.listener.fail({});assert.equal(await pending,false);
 m.api.showShareboard=o=>o.fail({});assert.equal(await p.shareReward(''),null);
 m.api.showShareboard=o=>o.success({});pending=p.shareReward('');const old=m.listener;
 t.mock.timers.tick(120000);assert.equal(await pending,false);old.success({});
 pending=p.shareReward('');old.success({});assert.equal(p.shareBusy,true);
 p.dispose();assert.equal(await pending,false);assert.equal(p.shareBusy,false);
});
test('missing template does not open sheet or consume a claim',async()=>{
 const m=sharing(),p=new TapPlatform(new Save(),false,m.api,{...config,shareTemplateId:''});
 assert.equal(p.shareAvailable,false);assert.equal(await p.shareReward(''),null);assert.equal(m.panel,undefined);p.dispose();
});
test('sharing grants one reward per UTC+8 day across all levels and tool kinds; video quota stays independent',()=>{
 const before=Date.parse('2026-11-11T15:59:00Z'),after=Date.parse('2026-11-11T16:01:00Z');
 const s=new Save('share-quotas');s.resetRewards(10);
 assert.equal(s.claim(10,'hint','share',before),true);
 assert.equal(s.claim(10,'erase','share',before),false);
 assert.equal(s.claim(11,'erase','share',before),false);
 assert.equal(s.claim(10,'erase','video',before),true);
 assert.equal(s.rewardLeft(10,'erase'),1);
 const stale=s.exportCloud();s.consumeReward(10,'erase');s.mergeCloud(stale);
 assert.equal(s.rewardLeft(10,'erase'),0);
 const reload=new Save('share-quotas');
 assert.equal(reload.canClaim(11,'erase','share',before),false);
 reload.resetRewards(10);reload.mergeCloud(stale);
 assert.equal(reload.rewardLeft(10,'hint'),1,'unspent share rewards survive restart');
 assert.equal(reload.canClaim(10,'hint','share',after),false,'restart never unlocks the same share claim');
 assert.equal(reload.canClaim(11,'erase','share',after),true,'a different level can share on the next day');
 assert.equal(reload.claim(11,'erase','share',after),true);
 assert.equal(reload.canClaim(12,'hint','share',after),false);
 assert.equal(reload.canClaim(12,'hint','share',before),false,'clock rollback cannot reclaim');
 assert.equal(reload.canClaim(10,'erase','video',after),true,'video quota resets with the board');
});
test('daily share claim persists through cloud restore and legacy metadata remains readable',()=>{
 const at=Date.parse('2026-11-11T15:59:00Z');
 const first=new Save('new-share-save');assert.equal(first.claim(10,'erase','share',at),true);
 const snapshot=first.exportCloud();
 const cloud=new Save('restored-share-save');cloud.replaceCloud(snapshot);
 assert.equal(cloud.canClaim(11,'hint','share',at),false);
 const legacy=JSON.parse(JSON.stringify(snapshot));delete legacy.meta.shareDailyClaims;
 const old=new Save('legacy-share-save');old.replaceCloud(legacy);
 assert.equal(old.canClaim(11,'hint','share',at),true);
 const invalid=JSON.parse(JSON.stringify(snapshot));invalid.meta.shareDailyClaims={'2026-02-30':1};
 assert.throws(()=>new Save('invalid-share-save').replaceCloud(invalid),/Invalid share claim/);
});
await import('../dist/js/main.js');await new Promise(r=>setImmediate(r));
const g=window.jadeDebug.game;
test('home leaderboard contains ranking only; empty tool buttons stay concise and modal offers both rewards',()=>{
 const m=sharing();g.platform=new TapPlatform(g.save,false,m.api,config);g.home();
 assert.ok(g.scene.children.some(c=>c.name==='button:leaderboard'));
 assert.ok(!g.accountStatus);g.tapMenu();
 const labels=g.modalCard.children.filter(c=>c.label).map(c=>c.label.text);
 assert.deepEqual(labels,['关卡榜','星数榜','关闭']);
 g.load(10,true);assert.equal(g.eraseLeft,0);assert.equal(g.eraseButton.label.text,'消除 ×0');
 g.toggleErase();assert.equal(g.modalOpen,true);
 assert.deepEqual(g.modalCard.children.filter(c=>c.label).map(c=>c.label.text),['看视频得消除','分享得消除','取消']);
 g.hideModal();
});
test('stale share callbacks cannot reward restarted boards; a completed share cannot be farmed by restart',async()=>{
 const m=sharing();g.platform=new TapPlatform(g.save,false,m.api,config);g.platform.sync=async()=>{};
 g.load(10,true);let pending=g.watchReward(10,'erase','share');
 g.cancel();assert.equal(g.platform.shareBusy,true);g.down({pointerId:1,stageX:300,stageY:400});assert.equal(g.drag,null);
 g.load(10,true);m.listener.success({});await pending;
 assert.equal(g.toolLeft('erase'),0);
 assert.equal(g.save.canClaim(10,'erase','share'),true,'an obsolete callback must not consume daily quota');
 pending=g.watchReward(10,'erase','share');m.listener.success({});await pending;
 assert.equal(g.toolLeft('erase'),1);assert.equal(g.save.canClaim(10,'erase'),true);
 g.toggleErase();assert.equal(g.toolNoticeBox.visible,true);assert.ok(g.eraseTip.fontSize>=30);
 assert.ok(g.toolNoticeBox.y+g.toolNoticeBox.height<=g.eraseButton.y-100);
 g.load(10);assert.equal(g.toolLeft('erase'),1);assert.equal(g.eraseLeft,0);
 g.load(10,true);assert.equal(g.toolLeft('erase'),1,'unspent share reward remains after restart');
 assert.equal(g.save.canClaim(10,'erase','share'),false,'restart must not grant a second share');
 assert.equal(g.save.canClaim(11,'hint','share'),false,'global daily quota applies to other levels');
});
