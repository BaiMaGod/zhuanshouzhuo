import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
const settle=()=>new Promise(r=>setImmediate(r));
test('8-second recovery window offers local play and late cloud data waits for home',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:100000});
 const h=installHarness();
 const {Save}=await import('../dist/js/storage.js');
 const remote=new Save('startup-timeout-fixture');remote.owner='legacy-owner';remote.win(12,3,2);
 const snapshot=JSON.stringify(remote.exportCloud());const reads=[];let uploads=0;
 globalThis.tap={login:()=>{},env:{USER_DATA_PATH:'tapfile://usr'},
  getCloudSaveManager:()=>({getArchiveList:o=>reads.push(o),getArchiveData:o=>o.success({filePath:o.targetFilePath}),updateArchive:o=>{uploads++;o.success({fileId:'updated'})}}),
  getFileSystemManager:()=>({readFile:o=>o.success({data:snapshot}),writeFile:o=>o.success({})})};
 await import('../dist/js/main.js');await settle();const g=window.jadeDebug.game;
 try{
  assert.equal(reads.length,1);t.mock.timers.tick(7999);await settle();assert.equal(g.modalOpen,false);
  t.mock.timers.tick(1);await settle();assert.equal(g.modalOpen,true);
  const button=g.modalCard.children.find(c=>c.label?.text==='继续本地游戏');assert.ok(button);button.click();
  assert.equal(g.mode,'game');assert.equal(g.model.index,0);
  const board=g.model;
  reads[0].success({saves:[{name:'jade_save_v1',uuid:'late-slot',fileId:'file'}]});await settle();h.tick();
  assert.equal(g.model,board);assert.equal(g.save.data.records[12],undefined);assert.equal(g.platform.ready,false);assert.equal(uploads,0);
  g.home();const pending=g.platform.resume();await settle();assert.equal(reads.length,2);
  reads[1].success({saves:[{name:'jade_save_v1',uuid:'late-slot',fileId:'file'}]});await pending;h.tick();
  assert.equal(g.platform.ready,true);assert.equal(g.save.owner,'archive:late-slot');assert.equal(g.save.data.records[12].stars,3);
  g.showPlatformCheck();assert.equal(g.platformLive.labels.length,5);
  const card=g.modalCard;t.mock.timers.tick(1000);h.tick();assert.equal(g.modalCard,card);
 }finally{g.platform.dispose();delete globalThis.tap}
});
