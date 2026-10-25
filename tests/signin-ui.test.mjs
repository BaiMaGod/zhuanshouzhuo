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


test('floral shortcuts and double-width seventh day retain separated readable rewards',()=>{
 g.home();
 const sign=g.scene.children.find(x=>x.name==='button:signin');
 const bag=g.scene.children.find(x=>x.name==='button:bag');
 assert.ok(sign.skin.graphics.ops.some(op=>op[0]==='image'&&op[1].endsWith('signin-shortcut.webp')),'approved painted sign-in artwork is drawn');
 assert.ok(bag.skin.graphics.ops.some(op=>op[0]==='image'&&op[1].endsWith('bag-shortcut.webp')),'approved painted pouch artwork is drawn');
 assert.ok(sign.children.some(x=>x.text==='签到'));
 assert.ok(bag.children.some(x=>x.text==='背包'));
 g.openSignIn();
 const day=(n)=>g.modalCard.children.find(x=>x.name==='signin-day:'+n);
 assert.ok(day(1)&&day(6)&&day(7));
 assert.equal(day(7).width,day(5).width*2+12);
 assert.equal(day(7).y,day(5).y);
 assert.ok(day(7).x>day(6).x+day(6).width);
 const texts=day(7).children.filter(x=>typeof x.text==='string').map(x=>x.text);
 assert.ok(texts.includes('提示×1'));
 assert.ok(texts.includes('消除×1'));
 assert.ok(!texts.some(x=>x.includes('提示×1 消除×1')),'gift copy must never wrap in the same field');
 const giftNodes=day(7).children.filter(x=>x.name?.startsWith('signin-reward-label:'));
 assert.equal(giftNodes.length,2);
 assert.ok(giftNodes[0].x+giftNodes[0].width<giftNodes[1].x,'Day 7 reward labels never overlap');
 g.hideModal();
});
