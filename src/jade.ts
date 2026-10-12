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
 const p=profiles[name],segments=192,rows=[0,.125,.5,.875,1],vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
 const r0=C.R-C.BAND/2,r1=C.R+C.BAND/2,half=Math.asin(C.GAP/(2*r0));
 for(let i=0;i<=segments;i++){
  const a=half+(Math.PI*2-2*half)*i/segments,cos=Math.cos(a),sin=Math.sin(a);
  const inner=sample(p.inner,a),outer=sample(p.outer,a);
  for(const fraction of rows){
   const radius=r0+(r1-r0)*fraction,sourceRadius=inner+(outer-inner)*fraction;
   vertices.push(cos*radius,sin*radius);
   uvs.push((p.cx+cos*sourceRadius)/p.width,(p.cy+sin*sourceRadius)/p.height);
  }
 }
 for(let i=0;i<segments;i++)for(let row=0;row<rows.length-1;row++){
  const a=i*rows.length+row,b=a+rows.length;
  indices.push(a,b,a+1,a+1,b,b+1);
 }
 const mesh={vertices:new Float32Array(vertices),uvs:new Float32Array(uvs),indices:new Uint16Array(indices)};
 meshes.set(name,mesh);return mesh;
}
export function drawJade(g:Laya.Graphics,name:JadeName):void{
 const mesh=jadeMesh(name);
 g.drawTriangles(Laya.loader.getRes('assets/jade-v2/'+name+'.png'),0,0,mesh.vertices,mesh.uvs,mesh.indices);
 // Pale polished cut faces remain strictly inside the same band and narrow wedge.
 const inner=C.R-C.BAND/2,outer=C.R+C.BAND/2,half=Math.asin(C.GAP/(2*inner));
 const colors:Record<JadeName,[string,string]>={
  amber:['#fff0a7','#fffde8'],peach:['#ffe1d4','#fff9f2'],celadon:['#d2e9cc','#f7fff0'],
  ice:['#cceee5','#f7fffb'],ivory:['#fff1ca','#fffef2']
 };
 for(const sign of[-1,1]){
  const a=sign*half,p=C.point({x:0,y:0},a/C.D,inner+.9),q=C.point({x:0,y:0},a/C.D,outer-.9);
  g.drawLine(p.x,p.y,q.x,q.y,colors[name][0],1.15);
  g.drawLine(p.x+.15,p.y+sign*.35,q.x-.15,q.y+sign*.35,colors[name][1],.42);
 }
}
export function jadeSprite(name:JadeName,x:number,y:number,scale=1,rotation=0):Laya.Sprite{
 const s=new Laya.Sprite();s.pos(x,y);s.scale(scale,scale);s.rotation=rotation;drawJade(s.graphics,name);return s;
}
