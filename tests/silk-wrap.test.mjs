import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {silkWrapPaths} from '../dist/js/silk-wrap.js';

const R=40,BAND=12,GAP=9;

test('缠丝层数由真实丝线数量表现，不生成文字标记',()=>{
 assert.equal(silkWrapPaths(0,R,BAND,GAP).length,0);
 assert.equal(silkWrapPaths(1,R,BAND,GAP).length,1);
 assert.equal(silkWrapPaths(2,R,BAND,GAP).length,2);
 assert.equal(silkWrapPaths(3,R,BAND,GAP).length,3);
 assert.equal(silkWrapPaths(4,R,BAND,GAP).length,3);
});

test('丝线始终贴合玉镯环带，并避开真实缺口',()=>{
 const paths=silkWrapPaths(3,R,BAND,GAP,120);
 const inner=R-BAND/2,outer=R+BAND/2;
 const halfGap=Math.asin(GAP/(2*inner))+.055;
 for(const path of paths){
  assert.equal(path.length,121);
  for(const p of path){
   const radius=Math.hypot(p.x,p.y);
   assert.ok(radius>inner && radius<outer, '丝线越出玉镯环带');
   const angle=(Math.atan2(p.y,p.x)+Math.PI*2)%(Math.PI*2);
   assert.ok(angle>=halfGap-1e-8 && angle<=Math.PI*2-halfGap+1e-8, '丝线跨过锁扣缺口');
  }
 }
});

test('逐层松开时，尚未松开的丝线位置保持稳定',()=>{
 const one=silkWrapPaths(1,R,BAND,GAP);
 const two=silkWrapPaths(2,R,BAND,GAP);
 const three=silkWrapPaths(3,R,BAND,GAP);
 assert.deepEqual(one[0],two[0]);
 assert.deepEqual(one[0],three[0]);
 assert.deepEqual(two[1],three[1]);
});

test('正式渲染器不再把缠字或层数绘制在玉镯中心',()=>{
 const source=readFileSync(new URL('../src/renderer.ts',import.meta.url),'utf8');
 assert.equal(source.includes('v.special'),false);
 assert.match(source,/drawSilkWrap/);
 assert.match(source,/silkReleases/);
});
