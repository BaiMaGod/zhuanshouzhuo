import test from 'node:test';
import assert from 'node:assert/strict';
import {jadeMesh,JADE_NAMES} from '../dist/js/jade.js';
import C from '../dist/js/core.js';
import profiles from '../dist/js/jade-profiles.js';
import {existsSync,readFileSync} from 'node:fs';
import {verifyPackagedImages,RUNTIME_IMAGES} from '../scripts/runtime-images.mjs';

test('五种生成材质注册到完全相同的玩法环体与缺口',()=>{
 const half=Math.asin(C.GAP/(2*(C.R-C.BAND/2))),meshes=JADE_NAMES.map(jadeMesh);
 for(let i=0;i<meshes.length;i++){
  const m=meshes[i];assert.ok(existsSync('dist/assets/jade-v2/'+JADE_NAMES[i]+'.png'));
  assert.deepEqual(m.vertices,meshes[0].vertices);
  for(let v=0;v<m.vertices.length;v+=2){
   const x=m.vertices[v],y=m.vertices[v+1],r=Math.hypot(x,y);
   assert.ok(r>=34-1e-5&&r<=46+1e-5);
   assert.ok(Math.abs(Math.atan2(y,x))>=half-1e-6,'所有三角形都避开真实细缺口');
  }
  for(const uv of m.uvs)assert.ok(uv>0&&uv<1);
  for(const idx of m.indices)assert.ok(idx<m.vertices.length/2);
  assert.equal(jadeMesh(JADE_NAMES[i]),m,'重开复用纹理网格');
 }
});
test('素材的内外边界注册有效，不把中心透明区域贴到环体上',()=>{
 for(const name of JADE_NAMES){
  const p=profiles[name];
  const png=readFileSync('dist/assets/jade-v2/'+name+'.png');
  assert.equal(p.width,png.readUInt32BE(16));assert.equal(p.height,png.readUInt32BE(20));
  assert.equal(p.inner.length,128);assert.equal(p.outer.length,128);
  p.inner.forEach((r,i)=>{assert.ok(p.outer[i]>r+p.width*90/1254);assert.ok(r>p.width*.3);assert.ok(p.outer[i]<p.width*.5)});
 }
});
test('缩图保持高清原图的归一化UV，运行包不含原图且不超过预算',()=>{
 const original=JSON.parse(readFileSync('art-source/jade-profiles.json','utf8'));
 for(const name of JADE_NAMES){const a=original[name],b=profiles[name];
  for(const axis of ['x','y'])assert.ok(Math.abs(a['c'+axis]/a[axis==='x'?'width':'height']-b['c'+axis]/b[axis==='x'?'width':'height'])<1e-12);
  for(const edge of ['inner','outer'])a[edge].forEach((r,i)=>assert.ok(Math.abs(r/a.width-b[edge][i]/b.width)<1e-12));
 }
 const report=verifyPackagedImages('dist/assets');assert.equal(report.count,RUNTIME_IMAGES.length);
});
