import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
installHarness();await import('../dist/js/main.js');await new Promise(r=>setImmediate(r));
const g=window.jadeDebug.game;
const {TapPlatform}=await import('../dist/js/taptap.js');
let close;
const api={createRewardedVideoAd:()=>({show:async()=>{},load:async()=>{},onClose:f=>{close=f},offClose:()=>{},onError:()=>{},offError:()=>{}})};
g.platform=new TapPlatform(g.save,false,api,{rewardedAdUnitId:'verified-test-config'});g.platform.ready=true;
g.platform.sync=async()=>{};
test('formal scene spends free tool first and advertisement reward second, resets claims on restart',async()=>{
 g.load(10,true);await g.hint();assert.equal(g.hintLeft,0);
 const reward=g.watchReward(10,'hint');assert.equal(g.platform.adBusy,true);
 close({isEnded:true});await reward;assert.equal(g.toolLeft('hint'),1);assert.equal(g.hintLeft,0);
 await g.hint();assert.equal(g.toolLeft('hint'),0);
 assert.equal(g.save.canClaim(10,'hint'),false);
 g.load(10,true);assert.equal(g.hintLeft,1);assert.equal(g.toolLeft('hint'),1);assert.equal(g.save.canClaim(10,'hint'),true);
 assert.equal(g.save.canClaim(10,'erase'),true);
 const cancel=g.watchReward(10,'erase');close({isEnded:false});await cancel;
 assert.equal(g.save.canClaim(10,'erase'),true);
 const erase=g.watchReward(10,'erase');close({isEnded:true});await erase;
 assert.equal(g.toolLeft('erase'),2);
 for(let i=0;i<2;i++){const ring=g.model.state.rings.find(r=>r.life==='active');g.eraseRing(ring.id)}
 assert.equal(g.toolLeft('erase'),0);assert.equal(g.save.canClaim(10,'erase'),false);
 g.load(11,true);assert.equal(g.save.canClaim(11,'hint'),true);
});
test('ad playback blocks input even when backgrounding cancels other interactions',async()=>{
 g.load(12,true);const state=JSON.stringify(g.model.state);
 const pending=g.watchReward(12,'hint');g.cancel();
 g.down({pointerId:1,stageX:300,stageY:400});assert.equal(g.drag,null);
 assert.equal(JSON.stringify(g.model.state),state);close({isEnded:true});await pending;
 assert.equal(g.busy,false);assert.equal(g.platform.adBusy,false);assert.equal(g.save.rewardLeft(12,'hint'),1);
});

test('an old advertisement callback cannot grant a restarted board a reward',async()=>{
 g.load(13,true);const pending=g.watchReward(13,'hint');g.load(13,true);
 close({isEnded:true});await pending;assert.equal(g.save.canClaim(13,'hint'),true);assert.equal(g.save.rewardLeft(13,'hint'),0);
});
