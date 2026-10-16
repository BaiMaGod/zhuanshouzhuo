globalThis.Laya={LocalStorage:{getItem:k=>globalThis.localStorage.getItem(k),setItem:(k,v)=>globalThis.localStorage.setItem(k,v)}};
import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../dist/js/core.js';
import solutions from '../dist/js/solutions.js';
import {TEACHING_COUNT,FORMAL_INDEX,FORMAL_COUNT,LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';
import {Save} from '../dist/js/storage.js';
import {trayFit,TRAY_SURFACE,RING_ENVELOPE} from '../dist/js/tray-layout.js';
import {readFileSync} from 'node:fs';

test('所有正式关完整外缘均在不同屏幕的玉盘内，密铺行没有中间空位',()=>{
 for(let number=1;number<=100;number++){
  const rings=C.make(TEACHING_COUNT+number-1).rings;
  const center={x:(Math.min(...rings.map(r=>r.x))+Math.max(...rings.map(r=>r.x)))/2,y:(Math.min(...rings.map(r=>r.y))+Math.max(...rings.map(r=>r.y)))/2};
  const rows=new Map;
  for(const r of rings){const key=Math.round(r.y*1000);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(r.x)}
  for(const xs of rows.values()){
   xs.sort((a,b)=>a-b);
   for(let i=1;i<xs.length;i++)assert.ok(Math.abs(xs[i]-xs[i-1]-92.0001)<.001,'filled row '+number);
  }
  for(const height of [936,1200]){
   const zoom=trayFit(rings,center,710,height);
   for(const r of rings)for(let degree=0;degree<360;degree+=15){
    const a=degree*Math.PI/180,x=(r.x-center.x+RING_ENVELOPE*Math.cos(a))*zoom/(710*TRAY_SURFACE.rx),y=(r.y-center.y+RING_ENVELOPE*Math.sin(a))*zoom/(height*TRAY_SURFACE.ry);
    assert.ok(x*x+y*y<=1,'tray '+number+'/'+r.id);
   }
  }
 }
 const version=JSON.parse(readFileSync('dist/version.json','utf8'));
 assert.equal(version.levels,110);assert.equal(version.teachingLevels,10);assert.equal(version.formalLevels,100);
});

test('旧54镯成绩只迁移到第45关一次，新的第1关和教学存档独立保存',()=>{
 const key='jade-bracelet-laya-v1',memory=new Map([[key,JSON.stringify({version:1,unlocked:6,sound:false,tutorial:3,records:{0:{steps:1,stars:3},10:{steps:54,stars:3}}})]]);
 globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 try{
  const save=new Save();assert.equal(save.data.version,2);assert.equal(save.data.unlocked,6);assert.equal(save.data.sound,false);assert.equal(save.data.tutorial,3);
  assert.equal(save.data.records[0].steps,1);assert.equal(save.data.records[LEGACY_FORMAL_INDEX].steps,54);assert.equal(save.data.records[FORMAL_INDEX],undefined);
  save.win(FORMAL_INDEX,9,9);save.win(109,108,108);
  const restored=new Save();assert.equal(restored.data.records[FORMAL_INDEX].steps,9);assert.equal(restored.data.records[LEGACY_FORMAL_INDEX].steps,54);assert.equal(restored.data.records[109].steps,108);assert.equal(restored.data.unlocked,6);
 }finally{delete globalThis.localStorage}
});
