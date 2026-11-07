import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../dist/js/core.js';
import {prepareSpecial,processSpecialRemoval,challengeDuration} from '../dist/js/advanced-mechanics.js';
import {compileApprovedSample} from '../dist/js/advanced-level-compiler.js';

function temporaryLevel(def,run){
 const index=C.levels.push({name:'test-advanced',points:[],links:[],...def})-1;
 try{return run(C.make(index))}finally{C.levels.pop()}
}
const unit={name:'test',index:0,steps:0,rings:[],rods:[],states:{},events:[]};
test('缠丝只能由不同的真实邻镯实际消除松层，重复回调不重复松',()=>{
 const s=structuredClone(unit);
 s.rings=[
  {id:'S1',x:92.0001,y:0,a:0,life:'removed'},
  {id:'S2',x:-46.00005,y:92.0001*Math.sqrt(3)/2,a:0,life:'active'},
  {id:'T',x:0,y:0,a:0,life:'active'},
  {id:'FAR',x:1000,y:0,a:0,life:'removed'}
 ];
 prepareSpecial(s,{special:{rings:[{id:'T',attribute:'silk',silkLayers:2}],
  silkEdges:[{sourceId:'S1',targetId:'T'},{sourceId:'S2',targetId:'T'},{sourceId:'FAR',targetId:'T'}]}});
 assert.equal(s.rings[2].silkRemaining,2);
 processSpecialRemoval(s,['S1','FAR']);
 assert.equal(s.rings[2].silkRemaining,1,'far source has no effect');
 processSpecialRemoval(s,['S1']);
 assert.equal(s.rings[2].silkRemaining,1,'same source cannot unlock twice');
 s.rings[1].life='removed';processSpecialRemoval(s,['S2']);
 assert.equal(s.rings[2].silkRemaining,0);
});
test('爆裂按实际邻居处理，整件多头背景扣只震断一次',()=>{
 const s=structuredClone(unit);
 s.rings=[
  {id:'A',x:0,y:0,life:'removed',a:0},
  {id:'B',x:92.0001,y:0,life:'active',a:0},
  {id:'C',x:184.0002,y:0,life:'active',a:0},
  {id:'D',x:1000,y:0,life:'active',a:0}
 ];
 s.rods=[
  {id:'M',kind:'m',owner:'C',targets:['B']},
  {id:'F',kind:'b',targets:['B','C','D']},
  {id:'NO',kind:'m',owner:'D',targets:['D']}
 ];
 prepareSpecial(s,{special:{rings:[{id:'A',attribute:'burst'}],silkEdges:[]}});
 processSpecialRemoval(s,['A']);
 assert.equal(s.rods[0].broken,true);
 assert.equal(s.rods[1].broken,true);
 assert.equal(s.rods[2].broken,undefined);
 assert.equal(s.events.filter(e=>e.kind==='burst').length,1);
 processSpecialRemoval(s,['A']);
 assert.equal(s.events.filter(e=>e.kind==='burst').length,1);
});
test('未解除缠丝时旋转被挡，道具消除后才松丝',()=>{
 temporaryLevel({
  points:[['A',0,0,150],['B',92.0001,0,25]],links:[['b','A','B']],
  special:{rings:[{id:'B',attribute:'silk',silkLayers:1}],silkEdges:[{sourceId:'A',targetId:'B'}]}
 },s=>{
  assert.equal(s.rings[1].silkRemaining,1);
  assert.equal(C.request(s,'B',25).blocked?.kind,'silk');
  s.rings[0].life='removed';C.processSpecialRemoval(s,['A']);C.update(s);
  assert.equal(s.rings[1].silkRemaining,0);
  assert.equal(C.processSpecialRemoval(s,['A']),undefined);
 });
});
test('多头背景扣逐端取位，所有端移除后才退出',()=>{
 const h=92.0001,y=h*Math.sqrt(3)/2;
 const coords=[[h,0],[-h/2,y],[-h/2,-y]];
 const targets=['A','B','C'];
 const ends=coords.map(([x,y],i)=>{
  const d=Math.hypot(x,y);return{id:targets[i],p:{x:x-x/d*40,y:y-y/d*40}};
 });
 temporaryLevel({
  points:coords.map(([x,y],i)=>[targets[i],x,y,45]),links:[],
  backgroundPieces:[{id:'STAR',anchorWorld:{x:0,y:0},
   endpoints:ends.map(e=>({receiverId:e.id,pointWorld:e.p})),
   branchPaths:ends.map(e=>[{x:0,y:0},e.p])}]
 },s=>{
  assert.equal(C.endpoints(s,s.rods[0]).length,3);
  assert.equal(C.validate(s).length,0);
  assert.equal(C.exists(s,s.rods[0]),true);
  s.rings[0].life='removed';C.update(s);
  assert.equal(s.states.STAR[0],'inactive');
  assert.equal(C.exists(s,s.rods[0]),true);
  s.rings[1].life='removed';s.rings[2].life='removed';C.update(s);
  assert.equal(C.exists(s,s.rods[0]),false);
 });
});
test('限时时长只可由已验证无道具路线计算',()=>{
 assert.equal(challengeDuration({steps:60,secondsPerStep:3,thinkingSeconds:20,routeVerified:true}),200);
 assert.equal(challengeDuration({steps:80,secondsPerStep:3.5,thinkingSeconds:25,routeVerified:true}),305);
 assert.throws(()=>challengeDuration({steps:200,secondsPerStep:3,thinkingSeconds:30,routeVerified:false}));
});
test('不能从七关仅有配额的骨架偷渡成正式关卡',()=>{
 assert.throws(()=>compileApprovedSample({level:107,ringCount:109,rings:[],validation:{}}),/样板未准备就绪/);
});
