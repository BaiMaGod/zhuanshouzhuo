// Scene contract test with an asynchronous native bridge; no real account used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
const harness=installHarness();
const {Save}=await import('../dist/js/storage.js');
const remote=new Save('startup-cloud-fixture');remote.owner='legacy-owner';remote.win(10,3,2);remote.win(11,3,2);
const snapshot=JSON.stringify(remote.exportCloud());
let authorize,authenticated=false,reads=0;
globalThis.tap={env:{USER_DATA_PATH:'tapfile://usr'},
 login:o=>{authorize=()=>{authenticated=true;o.success({code:'native-one-time-code'})}},
 getCloudSaveManager:()=>({
  getArchiveList:o=>{assert.equal(authenticated,true);reads++;o.success({saves:[{name:'jade_save_v1',uuid:'startup-slot',fileId:'file'}]})},
  getArchiveData:o=>o.success({filePath:o.targetFilePath}),
  updateArchive:o=>o.success({fileId:'updated'})
 }),
 getFileSystemManager:()=>({readFile:o=>o.success({data:snapshot}),writeFile:o=>o.success({})})
};
await import('../dist/js/main.js');await new Promise(r=>setImmediate(r));
const game=window.jadeDebug.game;

test('entering the game automatically logs in, restores cloud and refreshes home progress',async()=>{
 assert.equal(typeof authorize,'function');assert.equal(reads,0);assert.equal(game.platform.states.login,'busy');
 authorize();await new Promise(r=>setImmediate(r));harness.tick();
 assert.equal(reads,1);assert.equal(game.platform.ready,true);assert.equal(game.platform.states.login,'ready');
 assert.equal(game.save.owner,'archive:startup-slot');assert.equal(game.save.data.records[11].stars,3);
 assert.equal(game.mode,'home');assert.equal(game.modalOpen,false);
 assert.ok(game.scene.children.some(child=>child.label?.text==='第3关'));
});

test('returning to the foreground retries a failed restore without needing the menu',async()=>{
 game.platform.ready=false;game.platform.states.cloud='error';
 for(const handler of Laya.stage.events.focus)handler();
 await new Promise(r=>setImmediate(r));harness.tick();
 assert.equal(reads,2);assert.equal(game.platform.ready,true);assert.equal(game.mode,'home');
 game.platform.dispose();delete globalThis.tap;
});
