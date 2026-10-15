import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../dist/js/core.js';import {LEGACY_FORMAL_INDEX} from '../dist/js/levels.js';
import {trayFit,TRAY_SURFACE,RING_ENVELOPE} from '../dist/js/tray-layout.js';
test('正式54镯的完整旋转外缘在各屏幕玉盘内，保持原始密铺距离',()=>{
 const rings=C.make(LEGACY_FORMAL_INDEX).rings;
 const center={x:0,y:0};
 for(const h of [780,1058,1112,1300]){
  const zoom=trayFit(rings,center,710,h);
  assert.ok(zoom>0);
  for(const r of rings)for(let a=0;a<360;a+=.5){
   const t=a*Math.PI/180;
   const x=(r.x+RING_ENVELOPE*Math.cos(t))*zoom/(710*TRAY_SURFACE.rx);
   const y=(r.y+RING_ENVELOPE*Math.sin(t))*zoom/(h*TRAY_SURFACE.ry);
   assert.ok(x*x+y*y<=1,`${r.id} outside tray at ${h}/${a}`);
  }
  assert.ok(rings.some(r=>{
   for(let a=0;a<360;a++){
    const t=a*Math.PI/180,z=zoom*1.01;
    if(((r.x+RING_ENVELOPE*Math.cos(t))*z/(710*TRAY_SURFACE.rx))**2+((r.y+RING_ENVELOPE*Math.sin(t))*z/(h*TRAY_SURFACE.ry))**2>1)return true;
   }return false;
  }),'Fit should fill the safe surface');
 }
});
