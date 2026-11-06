import test from 'node:test';
import assert from 'node:assert/strict';
import {installHarness} from './scene-harness.mjs';

installHarness();
const {Victory}=await import('../dist/js/victory.js');

const base={title:'这一境，解开了',subtitle:'双镯保持',count:5,steps:7,stars:3,note:'下一节练习已开启'};
const find=(card,label)=>card.children.find(child=>child.name==='button:'+label);

test('tutorial victory places replay and next-step buttons side by side',()=>{
 const invoked=[];
 const victory=new Victory(new Laya.Sprite(),720,1100,{...base,actions:[
  {label:'进入第 6 境',action:()=>invoked.push('next'),primary:true},
  {label:'再解一次',action:()=>invoked.push('replay'),primary:false}
 ]});
 const next=find(victory.card,'进入第 6 境'),replay=find(victory.card,'再解一次');
 assert.ok(next&&replay);
 assert.deepEqual([replay.x,replay.y,replay.width,replay.height],[64,625,238,78]);
 assert.deepEqual([next.x,next.y,next.width,next.height],[318,625,238,78]);
 assert.equal(next.label.fontSize,replay.label.fontSize);
 assert.ok(replay.x+replay.width<next.x,'buttons have a visible gap');
 assert.ok(next.x+next.width<victory.card.width-12,'buttons remain inside the card');
 replay.click();next.click();assert.deepEqual(invoked,['replay','next']);
 victory.destroy();
});

test('formal three-action victory preserves its established arrangement',()=>{
 const victory=new Victory(new Laya.Sprite(),720,1100,{...base,actions:[
  {label:'下一关',action:()=>{},primary:true},
  {label:'回到首页',action:()=>{},primary:false},
  {label:'再挑战一次',action:()=>{},primary:false}
 ]});
 const next=find(victory.card,'下一关'),home=find(victory.card,'回到首页'),again=find(victory.card,'再挑战一次');
 assert.deepEqual([next.x,next.y,next.width,next.height],[64,577,492,84]);
 assert.deepEqual([home.x,home.y,home.width,home.height],[64,683,238,64]);
 assert.deepEqual([again.x,again.y,again.width,again.height],[318,683,238,64]);
 victory.destroy();
});
