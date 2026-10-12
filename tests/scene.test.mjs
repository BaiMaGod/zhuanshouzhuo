import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
const h=installHarness();
await import('../dist/js/main.js');
await new Promise(r=>setImmediate(r));
const g=window.jadeDebug.game,C=window.jadeDebug.Core;
g.audio.enabled=false;
test('正式场景导航、点击只选中、真实手势路径与逐关解锁',()=>{
 assert.equal(g.mode,'home');g.load(1);assert.equal(g.mode,'home','未解锁不能直接进入');
 g.load(0);assert.equal(g.mode,'game');assert.equal(g.modalOpen,true);g.hideModal();
 const ring=C.ring(g.model.state,'B'),startAngle=ring.a,p=g.board.toScreen(C.point(ring,70));
 const event=(q)=>({clientX:q.x/2,clientY:q.y/2,pointerId:8});
 g.down(event(p));g.up(event(p));assert.equal(ring.a,startAngle);assert.equal(g.model.state.steps,0);
 // Sweep on the actual ring hit area through the same controller used by pointers.
 g.down(event(p));
 for(let a=75;a<=185;a+=5)g.move(event(g.board.toScreen(C.point(ring,a))));
 g.up(event(p));
 assert.ok(g.model.cleared);assert.equal(g.model.state.steps,1);
 for(let i=0;i<25;i++)h.tick();
 assert.equal(g.save.data.unlocked,1);assert.ok(g.modalOpen);assert.ok(g.settled);
});
test('取消、重开与撤销解除指针捕获，恢复完整场景',()=>{
 g.load(1);const r=C.ring(g.model.state,'B'),p=g.board.toScreen(C.point(r,290));
 const e={clientX:p.x/2,clientY:p.y/2,pointerId:9};
 g.down(e);assert.equal(h.canvas.captured,9);g.cancel();assert.equal(g.drag,null);assert.equal(h.canvas.captured,null);
 g.manual(30);assert.ok(g.model.history.length);g.undo();
 assert.equal(g.model.state.steps,0);assert.deepEqual(C.validate(g.model.state),[]);
 g.load(1);assert.equal(g.busy,false);assert.equal(g.drag,null);
});
test('演示实际调用逐帧正常旋转入口，完成后才能结算',async()=>{
 g.load(1);await g.automatic(true);h.tick();
 assert.ok(g.model.cleared);assert.equal(g.busy,false);assert.ok(g.settled);
 assert.equal(g.save.data.unlocked,2);assert.equal(g.model.state.steps,2);
});
test('全屏板内缩放和输入坐标互逆',()=>{
 g.save.data.unlocked=9;
 for(let i=0;i<10;i++){
  g.load(i);
  for(const r of g.model.state.rings){
   const p=g.board.toScreen(r),q=g.board.toWorld(p);
   assert.ok(Math.abs(q.x-r.x)<1e-7&&Math.abs(q.y-r.y)<1e-7);
   assert.ok(p.x>30&&p.x<690&&p.y>235&&p.y<950);
  }
 }
});
