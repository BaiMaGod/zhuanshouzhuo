import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
installHarness();
await import('../dist/js/main.js');
await new Promise(r=>setImmediate(r));
const g=window.jadeDebug.game;
g.audio.enabled=false;

test('home sign-in and bag shortcuts stay on opposite screen edges, above the play button',()=>{
 g.home();
 const left=g.scene.children.find(x=>x.name==='button:signin');
 const right=g.scene.children.find(x=>x.name==='button:bag');
 const play=g.scene.children.find(x=>x.name==='button:第1关');
 assert.ok(left&&right&&play);
 assert.equal(left.x,12);
 assert.equal(right.x+right.width,720-12);
 assert.equal(left.y,right.y);
 assert.ok(left.y+left.height<play.y,'shortcuts are above, not beside, the main button');
 assert.ok(left.events.click?.length&&right.events.click?.length);
});

test('sign-in dialog grants into bag, bag can be opened and level restart leaves inventory intact',()=>{
 g.home();
 assert.equal(g.homeSignDot.visible,true);
 g.openSignIn();
 assert.equal(g.modalOpen,true);
 assert.ok(g.modalCard?.children.some(x=>x.name==='button:claim-signin'));
 g.claimSignIn();
 assert.equal(g.save.inventoryLeft('hint'),1);
 assert.equal(g.save.inventoryLeft('erase'),0);
 assert.equal(g.homeSignDot.visible,false);
 g.openBag();
 assert.equal(g.modalOpen,true);
 assert.ok(g.modalCard?.children.some(x=>x.name==='button:close-bag'));
 g.hideModal();
 g.load(10,true);
 assert.equal(g.toolLeft('hint'),2,'one free hint plus one persistent hint');
 g.consumeTool('hint');
 assert.equal(g.hintLeft,0);
 assert.equal(g.save.inventoryLeft('hint'),1,'free charges must be consumed first');
 g.consumeTool('hint');
 assert.equal(g.save.inventoryLeft('hint'),0);
 g.load(10,true);
 assert.equal(g.save.inventoryLeft('hint'),0,'restarting the level does not refund inventory');
 assert.equal(g.hintLeft,1,'but free hint is restored');
});
