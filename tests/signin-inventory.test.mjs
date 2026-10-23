import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
installHarness();
const {Save}=await import('../dist/js/storage.js');
const {chinaDateKey,DAILY_REWARDS}=await import('../dist/js/signin-inventory.js');
const at=(day,hour=12)=>Date.UTC(2026,9,day,hour-8,0,0);

test('Beijing midnight, one claim per day, misses never reset and day eight restarts at day one',()=>{
 const s=new Save('daily-cycle');
 assert.equal(chinaDateKey(Date.UTC(2026,9,23,15,59)), '2026-10-23');
 assert.equal(chinaDateKey(Date.UTC(2026,9,23,16,1)), '2026-10-24');
 assert.equal(s.dailySignInStatus(at(23)).todaySlot,1);
 let hint=0,erase=0;
 for(let i=0;i<7;i++){
  const now=at(23+i);
  const grant=s.claimDaily(now);
  assert.equal(grant.ok,true);
  assert.equal(grant.status.todaySlot,i+1);
  assert.equal(s.claimDaily(now).ok,false,'no second claim in the same Beijing date');
  hint+=DAILY_REWARDS[i].hint;erase+=DAILY_REWARDS[i].erase;
 }
 assert.equal(hint,7);assert.equal(erase,2);
 assert.equal(s.inventoryLeft('hint'),7);assert.equal(s.inventoryLeft('erase'),2);
 assert.equal(s.dailySignInStatus(at(30)).todaySlot,1);
 assert.equal(s.dailySignInStatus(at(30)).completed,0);
 assert.equal(s.claimDaily(at(30)).reward.hint,1);
 assert.equal(s.inventoryLeft('hint'),8);
 const missed=new Save('daily-missed');
 missed.claimDaily(at(23));
 assert.equal(missed.dailySignInStatus(at(30)).todaySlot,2);
 assert.equal(missed.claimDaily(at(30)).status.completed,2);
});

test('inventory survives relaunch and level restart; spent tools cannot be resurrected by stale cloud',()=>{
 const s=new Save('daily-relaunch');
 s.claimDaily(at(23));
 s.consumeInventory('hint',10,at(24));
 assert.equal(s.inventoryLeft('hint'),0);
 assert.equal(new Save('daily-relaunch').inventoryLeft('hint'),0);
 const stale=new Save('daily-stale');
 stale.claimDaily(at(23));
 assert.equal(stale.inventoryLeft('hint'),1);
 s.mergeCloud(stale.exportCloud());
 assert.equal(s.inventoryLeft('hint'),0,'stale cloud cannot refund permanent items');
 s.resetRewards(10);
 assert.equal(s.inventoryLeft('hint'),0,'level restart only resets temporary rewards');
});

test('two devices claiming same calendar date merge to one grant and distinct dates merge',()=>{
 const a=new Save('claim-device-a'),b=new Save('claim-device-b');
 a.claimDaily(at(23));b.claimDaily(at(23));
 a.mergeCloud(b.exportCloud());
 assert.equal(a.inventoryLeft('hint'),1);
 b.claimDaily(at(24));
 a.mergeCloud(b.exportCloud());
 assert.equal(a.dailySignInStatus(at(24)).totalDays,2);
 assert.equal(a.inventoryLeft('hint'),2);
 assert.equal(a.claimDaily(at(24)).ok,false);
});

test('old save metadata migrates without corrupting old progress or rewards',()=>{
 const key='daily-legacy';
 Laya.LocalStorage.setItem(key+'-meta',JSON.stringify({revision:3,dirty:false,tainted:false,rankRecords:{},rewards:{10:{hint:{claimed:true,remaining:1,generation:0}}}}));
 const s=new Save(key);
 assert.equal(s.inventoryLeft('hint'),0);
 assert.equal(s.rewardLeft(10,'hint'),1);
 assert.equal(s.claimDaily(at(23)).ok,true);
 assert.equal(s.rewardLeft(10,'hint'),1);
 assert.equal(new Save(key).inventoryLeft('hint'),1);
});

test('invalid/rolled-back device dates do not award more items',()=>{
 const s=new Save('daily-clock');
 s.claimDaily(at(25));
 assert.equal(s.claimDaily(at(24)).ok,false);
 assert.equal(s.dailySignInStatus(at(24)).clockInvalid,true);
 assert.equal(s.inventoryLeft('hint'),1);
});
