globalThis.Laya={LocalStorage:{getItem:k=>globalThis.localStorage.getItem(k),setItem:(k,v)=>globalThis.localStorage.setItem(k,v)}};
import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../dist/js/core.js';
import solutions from '../dist/js/solutions.js';
import {GameModel} from '../dist/js/model.js';
import {Save} from '../dist/js/storage.js';

for(let i=0;i<10;i++){
 test('第 '+(i+1)+' 关几何与连续通关路径',()=>{
  const s=C.make(i);assert.deepEqual(C.validate(s),[]);
  assert.equal(C.settle(C.clone(s)).length,0,'开局不得隐性清空');
  for(const a of solutions[i]){
   let remain=a.delta;
   while(Math.abs(remain)>.001){
    const res=C.request(s,a.id,Math.sign(remain)*Math.min(2.4,Math.abs(remain)));
    assert.equal(res.blocked,null,JSON.stringify(res.blocked));
    assert.ok(Math.abs(res.done)>.00001);
    remain-=res.done;
    if(C.ring(s,a.id).life==='removed')break;
   }
  }
  assert.ok(s.rings.every(r=>r.life==='removed'));
  assert.ok(s.rods.filter(z=>z.kind==='b').every(z=>!C.exists(s,z)),'清空玉环后不应残留背景固定扣');
  assert.ok(s.rods.filter(z=>z.kind==='m').every(z=>!C.exists(s,z)),'所属杆随镯消除');
  assert.deepEqual(C.settle(s),[],'清空不能重复产生消除事件');
 });
}
test('receiver 旋转不带动所属杆，owner 强转被环体阻挡',()=>{
 const s=C.make(0),z=s.rods[0],pose=C.clone(C.pose(s,z)),a=C.ring(s,'A').a;
 C.request(s,'B',20);assert.deepEqual(C.pose(s,z),pose);
 const blocked=C.request(s,'A',30);
 assert.ok(blocked.blocked);assert.ok(blocked.done<1,'允许套扣几何公差内的小幅移动，但不允许强转');
 assert.ok(Math.abs(C.dist(C.ring(s,'B'),C.pose(s,z).q)-C.R)<=.025);
 assert.ok(Math.abs(C.diff(C.ring(s,'A').a,a))<1);
});
test('背景双端独立判断；一端消除不删除本体和另一端',()=>{
 const s=C.make(1),z=s.rods[0],p=C.clone(C.pose(s,z));
 const q=C.endpoints(s,z)[0],r=C.ring(s,q.id);
 const res=C.request(s,r.id,C.diff(C.angle(r,q.p),r.a));
 assert.deepEqual(res.removed,['A']);
 assert.deepEqual(C.pose(s,z),p);
 assert.equal(s.states[z.id][0],'inactive');assert.equal(s.states[z.id][1],'latched');
 assert.ok(C.exists(s,z));assert.equal(C.ring(s,'B').life,'active');
});
test('背景固定扣只在两端玉环都消失后移除，并且消除道具同样生效',()=>{
 const s=C.make(1),z=s.rods.find(z=>z.kind==='b');
 assert.ok(z);assert.equal(C.exists(s,z),true,'开局存在背景固定扣');
 C.ring(s,z.targets[0]).life='removed';C.update(s);
 assert.equal(C.exists(s,z),true,'仅一端消除时保留固定扣');
 C.ring(s,z.targets[1]).life='removed';C.update(s);
 assert.equal(C.exists(s,z),false,'两端都消除时固定扣不再存在');
 assert.deepEqual(s.states[z.id],['inactive','inactive']);
 assert.equal(C.candidates(s).some(a=>a.rod===z.id),false,'移除后的固定扣不再参与提示候选');
 const model=new GameModel(1),fixed=model.state.rods.find(z=>z.kind==='b');
 model.removeWithTool(fixed.targets[0]);model.removeWithTool(fixed.targets[1]);
 assert.equal(C.exists(model.state,fixed),false,'道具消除后也不残留固定扣');
});
test('三镯顺序，B 消除后保留 A 的完整杆，再随 A 正常旋转',()=>{
 const s=C.make(2);const first=solutions[2][0];C.request(s,first.id,first.delta);
 assert.equal(C.ring(s,'B').life,'removed');assert.equal(C.ring(s,'A').life,'active');
 const z=s.rods.find(z=>z.owner==='A');assert.ok(C.exists(s,z));
 const pose=C.pose(s,z),length=C.dist(pose.p,pose.q),a=solutions[2][1];
 const res=C.request(s,a.id,Math.sign(a.delta)*1);assert.equal(res.blocked,null);
 assert.notDeepEqual(C.pose(s,z),pose);
 assert.ok(Math.abs(C.dist(C.pose(s,z).p,C.pose(s,z).q)-length)<1e-7);
});
test('保持组合：对齐不累计，转离重新扣合，不提前消除',()=>{
 const s=C.make(4);
 // Remove the two peripheral receiver rings before aligning the shared owner G.
 for(const a of solutions[4].filter(a=>['C','D'].includes(a.id)))C.request(s,a.id,a.delta);
 const z=s.rods.find(z=>z.owner==='G'&&z.targets[0]==='A'),r=C.ring(s,'A'),p=C.pose(s,z).q;
 const res=C.request(s,'A',C.diff(C.angle(r,p),r.a));
 assert.equal(res.blocked,null);assert.equal(s.states[z.id][0],'aligned');
 assert.equal(C.ring(s,'A').life,'active');assert.equal(C.ring(s,'G').life,'active');
 const blocked=C.request(s,'G',30);assert.ok(blocked.done<1);assert.ok(blocked.blocked,'aligned 不放行 owner');
 C.request(s,'A',3);assert.equal(s.states[z.id][0],'latched');
 assert.equal(C.ring(s,'G').life,'active');
});
test('撤销恢复所有几何、连接与步数',()=>{
 const m=new GameModel(2),initial=C.clone(m.state),selection=m.selected;
 m.begin();m.turn(solutions[2][0].id,solutions[2][0].delta);
 assert.ok(m.state.rings.some(r=>r.life==='removed'));
 assert.ok(m.undo());assert.deepEqual(m.state,initial);assert.equal(m.selected,selection);
});
test('跨零度连续旋转不丢事件',()=>{
 const s=C.make(1),r=C.ring(s,'B');r.a=359;C.update(s);
 const res=C.request(s,'B',2);assert.equal(res.blocked,null);assert.equal(r.a,1);
 assert.equal(C.diff(1,359),2);assert.equal(C.diff(359,1),-2);
});
test('大步请求与细步输入产生同样的规则状态',()=>{
 for(let i=0;i<10;i++){
  const big=C.make(i),small=C.make(i);
  for(const a of solutions[i]){
   C.request(big,a.id,a.delta);
   let remaining=a.delta;
   while(Math.abs(remaining)>.001){
    const r=C.request(small,a.id,Math.sign(remaining)*Math.min(1,Math.abs(remaining)));
    assert.equal(r.blocked,null);remaining-=r.done;
    if(C.ring(small,a.id).life==='removed')break;
   }
  }
  assert.deepEqual(big.rings.map(r=>r.life),small.rings.map(r=>r.life));
  assert.deepEqual(big.states,small.states);
 }
});
test('关卡解锁与刷新保存，异常存档不破坏进度',()=>{
 const memory=new Map;
 globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const save=new Save();assert.equal(save.data.unlocked,0);
 assert.equal(save.win(0,1,1),3);assert.equal(save.data.unlocked,1);
 assert.equal(new Save().data.unlocked,1);
 save.win(0,30,1);assert.equal(save.data.records[0].stars,3);assert.equal(save.data.records[0].steps,1);
 memory.set('jade-bracelet-laya-v1','{broken');assert.equal(new Save().data.unlocked,0);
 delete globalThis.localStorage;
});
