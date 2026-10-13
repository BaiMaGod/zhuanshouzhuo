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
 g.load(0);assert.equal(g.mode,'game');assert.equal(g.modalOpen,false);assert.ok(g.guide,'New player gets in-board coach without a blocking modal');
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

test('新手引导跟随真实选择，可跳过/重学且保存标记不覆盖通关记录',()=>{
 g.load(0);g.startGuide();assert.equal(g.modalOpen,false);assert.equal(g.guide.phase,'choose');
 g.guideSelect('A');assert.equal(g.guide.phase,'choose');
 g.guideSelect('B');assert.equal(g.guide.phase,'turn');
 g.stopGuide(true);assert.equal(g.guide,null);assert.ok(g.save.data.tutorial>=1);
 const record=JSON.stringify(g.save.data.records);g.practice();assert.ok(g.guide);assert.equal(g.model.index,0);
 assert.equal(JSON.stringify(g.save.data.records),record);
 g.stopGuide(false);g.home();assert.equal(g.mode,'home');assert.equal(g.guide,null);
 g.settings();assert.equal(g.modalOpen,true);g.hideModal();assert.equal(g.modalOpen,false);
});

test('按钮按下/移出复原，禁用状态不触发动作',()=>{
 g.home();const b=g.scene.children.find(n=>n.label?.text==='继续解镯');
 assert.ok(b);for(const f of b.events.mousedown)f();assert.equal(b.skin.y,4);
 for(const f of b.events.mouseout)f();assert.equal(b.skin.y,0);
 b.enabled=false;b.click();assert.equal(g.mode,'home');
 b.enabled=true;b.click();assert.equal(g.mode,'game');
});


test('正式关独立开放且没有微调、演示，双指缩放不旋转玉镯',()=>{
 g.save.data.unlocked=0;g.home();g.load(10);assert.equal(g.model.index,10);assert.equal(g.controls.length,0);assert.equal(g.demoButton,null);assert.equal(g.guide,null);
 const before=C.clone(g.model.state),board=g.board,mid={x:board.rect.x+board.rect.w/2,y:board.rect.y+board.rect.h/2},event=(x,y,id)=>({clientX:x/2,clientY:y/2,pointerId:id,button:0});
 g.down(event(mid.x-50,mid.y,31));g.down(event(mid.x+50,mid.y,32));g.move(event(mid.x-100,mid.y,31));g.move(event(mid.x+100,mid.y,32));
 assert.ok(board.zoom>board.fitZoom*1.9);assert.deepEqual(g.model.state,before);assert.equal(g.drag,null);
 g.up(event(mid.x+100,mid.y,32));g.move(event(mid.x-90,mid.y+30,31));assert.deepEqual(g.model.state,before,'remaining pinch finger cannot accidentally rotate');g.up(event(mid.x-90,mid.y+30,31));assert.equal(g.viewGesture,null);
 g.panMode=true;const screen={...board.screen};g.down(event(mid.x,mid.y,33));g.move(event(mid.x+60,mid.y+40,33));g.up(event(mid.x+60,mid.y+40,33));assert.ok(board.screen.x!==screen.x||board.screen.y!==screen.y);assert.deepEqual(g.model.state,before);
 for(const r of g.model.state.rings){const q=board.toWorld(board.toScreen(r));assert.ok(Math.abs(q.x-r.x)<1e-7&&Math.abs(q.y-r.y)<1e-7)}
 g.manual(30);assert.deepEqual(g.model.state,before);g.releasePointers();board.resetView();assert.equal(board.zoom,board.fitZoom);g.load(10);assert.equal(g.panMode,false);assert.equal(g.pointers.size,0);
});
