import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';
const h=installHarness();
const {Board}=await import('../dist/js/renderer.js');
const {HeartLinks}=await import('../dist/js/heart-links.js');
const C=(await import('../dist/js/core.js')).default;

test('魔法连接开局不锁操作，分次传递消除，重开清空飞行残留',()=>{
 const index=C.levels.push({name:'link scene',points:[['A',-92.0001,0,150],['B',0,0,25],['C',92.0001,0,25]],links:[['b','A','B'],['b','B','C']],special:{linked:true,rings:[{id:'B',attribute:'silk',silkLayers:2}],silkEdges:[{sourceId:'A',targetId:'B'},{sourceId:'C',targetId:'B'}]}})-1;
 try{
  const before=C.make(index),board=new Board(new Laya.Sprite(),{x:0,y:0,w:360,h:500});board.load(before,{w:720,h:1000});board.draw(before);
  assert.equal(board.animating,false,'opening is decorative and never locks input');
  assert.equal(board.hasFeedback,true,'opening requests frames');
  const after=C.clone(before);after.rings[0].life='removed';const rest=C.processSpecialRemoval(after,['A']);C.update(after);
  board.release(before,after,['A',...rest]);
  assert.equal(board.pendingFlameHits,2);
  board.draw(after,h.now+150);
  assert.equal(board.rings.get('B').root.visible,true,'not-yet-reached ring remains visible');
  board.advanceFlame(after,h.now+301);assert.equal(board.pendingFlameHits,1);
  board.advanceFlame(after,h.now+601);assert.equal(board.pendingFlameHits,0);
  board.load(before,{w:720,h:1000});board.draw(before);assert.equal(board.pendingFlameHits,0);
  const magic=board.space.children.find(n=>n.name==='heart-links');assert.equal(magic.flights.length,0);
 }finally{C.levels.pop();}
});
test('低动态模式无飞入动画，但保留清楚的镯心连接',()=>{
 const layer=new HeartLinks();const s={rings:[{id:'A',x:0,y:0,life:'active'},{id:'B',x:92,y:0,life:'active'}],special:{linked:true,linkGroups:[['A','B']]}};
 layer.load(s,{x:46,y:0});layer.draw(s,h.now,true);
 const ops=layer.graphics.ops;assert.ok(ops.some(op=>op[0]==='path'));assert.ok(ops.some(op=>op[0]==='circle'));
 layer.load({...s,special:undefined},{x:0,y:0});layer.draw(s,h.now,false);assert.equal(layer.graphics.ops.length,0);
});

test('连心盘面存档恢复保留组关系，拒绝篡改组与旧修订盘面',async()=>{
 const {Save}=await import('../dist/js/storage.js');
 const key='heart-link-save-test',index=140,state=C.make(index);
 const save=new Save(key);save.writeRun(index,state,0,0);
 assert.deepEqual(new Save(key).readRun(index).state.special.linkGroups,state.special.linkGroups);
 const raw=JSON.parse(Laya.LocalStorage.getItem(key+'-run-'+index));
 raw.state.special.linkGroups[0].push('R999');Laya.LocalStorage.setItem(key+'-run-'+index,JSON.stringify(raw));
 assert.equal(new Save(key).readRun(index),null);
 save.writeRun(index,{...state,steps:1},0,0);
 const previous=JSON.parse(Laya.LocalStorage.getItem(key+'-run-'+index));previous.levelRevision--;Laya.LocalStorage.setItem(key+'-run-'+index,JSON.stringify(previous));
 assert.equal(new Save(key).readRun(index),null);
});
