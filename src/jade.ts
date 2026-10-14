import C0 from './core.js';
import profiles0 from './jade-profiles.js';
import type {CoreAPI} from './types.js';
const C=C0 as unknown as CoreAPI;
export const JADE_NAMES=['amber','peach','celadon','ice','ivory'] as const;
export type JadeName=typeof JADE_NAMES[number];
interface Profile {width:number;height:number;cx:number;cy:number;inner:number[];outer:number[]}
const profiles=profiles0 as Record<JadeName,Profile>;
export const JADE_ASSETS=JADE_NAMES.map(n=>'assets/jade-v2/'+n+'.png');
export interface JadeMesh {vertices:Float32Array;uvs:Float32Array;indices:Uint16Array}
const meshes=new Map<JadeName,JadeMesh>();
function sample(values:number[],angle:number):number{
 const t=((angle/(Math.PI*2)*values.length)%values.length+values.length)%values.length;
 const i=Math.floor(t),f=t-i;return values[i]*(1-f)+values[(i+1)%values.length]*f;
}
export function jadeMesh(name:JadeName):JadeMesh{
 const cached=meshes.get(name);if(cached)return cached;
 // At the largest board zoom, 64 arc segments deviate by under 0.2 stage pixels.
 const p=profiles[name],segments=64,vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
 const columns:{start:number;rows:number[]}[]=[];
 const r0=C.R-C.BAND/2,r1=C.R+C.BAND/2,half=Math.asin(C.GAP/(2*r0));
 for(let i=0;i<=segments;i++){
  const base=half+(Math.PI*2-2*half)*i/segments;
  // Only the two tip sections need extra cross-section rows. Keep the rest light.
  const rows=Math.min(i,segments-i)<2?[0,.067,.25,.5,.75,.933,1]:[0,.5,1];
  columns.push({start:vertices.length/2,rows});
  for(const fraction of rows){
   // Round the tips inward, never extending jade into the authoritative gap.
   const cross=fraction*2-1,cap=C.BAND/2*(1-Math.sqrt(Math.max(0,1-cross*cross)))/C.R;
   const edge=Math.max(0,1-Math.min(i,segments-i)/2);
   const a=base+(i<segments/2?1:-1)*cap*edge,cos=Math.cos(a),sin=Math.sin(a);
   const inner=sample(p.inner,a),outer=sample(p.outer,a);
   const radius=r0+(r1-r0)*fraction,sourceRadius=inner+(outer-inner)*fraction;
   vertices.push(cos*radius,sin*radius);
   uvs.push((p.cx+cos*sourceRadius)/p.width,(p.cy+sin*sourceRadius)/p.height);
  }
 }
 for(let i=0;i<segments;i++){
  const left=columns[i],right=columns[i+1];let l=0,r=0;
  while(l<left.rows.length-1||r<right.rows.length-1){
   const nextL=left.rows[l+1]??Infinity,nextR=right.rows[r+1]??Infinity;
   if(nextL<=nextR){indices.push(left.start+l,right.start+r,left.start+l+1);l++}
   else{indices.push(left.start+l,right.start+r,right.start+r+1);r++}
  }
 }
 const mesh={vertices:new Float32Array(vertices),uvs:new Float32Array(uvs),indices:new Uint16Array(indices)};
 meshes.set(name,mesh);return mesh;
}
export function drawJade(g:Laya.Graphics,name:JadeName):void{
 const mesh=jadeMesh(name);
 const tint:Record<JadeName,string>={amber:'#eee2bd',peach:'#fff1eb',celadon:'#e7f1dd',ice:'#e2f4ee',ivory:'#f3e8c9'};
 g.drawTriangles(Laya.loader.getRes('assets/jade-v2/'+name+'.png'),0,0,mesh.vertices,mesh.uvs,mesh.indices,null,1,tint[name]);
 // A short curved highlight follows each smoothly polished rounded end.
 const inner=C.R-C.BAND/2,half=Math.asin(C.GAP/(2*inner));
 const colors:Record<JadeName,[string,string]>={
  amber:['#fff0a7','#fffde8'],peach:['#ffe1d4','#fff9f2'],celadon:['#d2e9cc','#f7fff0'],
  ice:['#cceee5','#f7fffb'],ivory:['#fff1ca','#fffef2']
 };
 for(const sign of[-1,1]){
  const path:unknown[]=[];
  for(let i=1;i<12;i++){
   const f=i/12,cross=f*2-1,a=sign*(half+C.BAND/2*(1-Math.sqrt(1-cross*cross))/C.R+.008);
   const p=C.point({x:0,y:0},a/C.D,inner+C.BAND*f);
   path.push([i===1?'moveTo':'lineTo',p.x,p.y]);
  }
  g.drawPath(0,0,path,undefined,{strokeStyle:sign<0?colors[name][1]:colors[name][0],lineWidth:.55});
 }
}
export function jadeSprite(name:JadeName,x:number,y:number,scale=1,rotation=0):Laya.Sprite{
 const s=new Laya.Sprite();s.pos(x,y);s.scale(scale,scale);s.rotation=rotation;drawJade(s.graphics,name);return s;
}
