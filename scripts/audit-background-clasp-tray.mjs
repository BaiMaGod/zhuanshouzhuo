#!/usr/bin/env node
// Geometry release gate for the large background clasps in levels 131-145.
import Core from '../src/core.js';

function trayScale(rings,center,height){
 const rx=710*.455,ry=height*.405;
 let extent=0;
 for(const ring of rings)for(let degree=0;degree<360;degree++){
  const a=degree*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  extent=Math.max(extent,((ring.x-center.x)*c/rx+(ring.y-center.y)*s/ry)+56*Math.hypot(c/rx,s/ry));
 }
 return Math.cos(Math.PI/360)/extent;
}
function insideTray(point,center,scale,height,padding){
 const rx=710*.455,ry=height*.405;
 const normalized=Math.hypot((point.x-center.x)*scale/rx,(point.y-center.y)*scale/ry);
 return normalized+padding*scale/Math.min(rx,ry)<=1+1e-5;
}
let checked=0,anchors=0,branches=0;
for(let number=131;number<=145;number++){
 const level=Core.levels.find(item=>item.name==='第'+number+'关');
 if(!level)throw Error('Missing runtime level '+number);
 const rings=level.points.map(([id,x,y])=>({id,x,y}));
 const xs=rings.map(r=>r.x),ys=rings.map(r=>r.y);
 const center={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
 for(const height of [936,1200]){
  const scale=trayScale(rings,center,height);
  for(const piece of level.backgroundPieces||[])if(piece.heads>=4){
   if(!insideTray(piece.anchorWorld,center,scale,height,14))
    throw Error('Level '+number+' '+piece.id+' anchor is outside the '+height+'px jade tray');
   anchors++;
   for(const path of piece.branchPaths)for(const point of path){
    if(!insideTray(point,center,scale,height,3))
     throw Error('Level '+number+' '+piece.id+' branch is outside the '+height+'px jade tray');
    branches++;
   }
  }
 }
 checked++;
}
console.log('Tray audit passed: '+checked+' levels, '+anchors+' large-clasp anchor checks, '+branches+' branch-point checks across 936px and 1200px layouts.');
