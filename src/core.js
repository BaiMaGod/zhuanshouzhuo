
/* V3.2 core: authoritative endpoint states, fixed local mount geometry, continuous shared rotation.
   Cuffs are rectangular sleeves with tangential passage width 7, radial span 18.
   Captive sleeve on a present receiver has no invented escape DOF; radial contact is constrained.
   Removed rings leave the 2D plane; render ghosts are noninteractive until the 260ms exit finishes. */
import {levels,COLORS} from "./levels.js";
const Core=(()=>{const R=40,BAND=12,GAP=9,END=7,STEP=.25,D=Math.PI/180;
const norm=a=>((a%360)+360)%360, diff=(a,b)=>((a-b+540)%360)-180, clone=x=>JSON.parse(JSON.stringify(x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), rot=(p,a)=>({x:p.x*Math.cos(a*D)-p.y*Math.sin(a*D),y:p.x*Math.sin(a*D)+p.y*Math.cos(a*D)});
const angle=(a,b)=>norm(Math.atan2(b.y-a.y,b.x-a.x)/D), point=(r,a,d=R)=>({x:r.x+Math.cos(a*D)*d,y:r.y+Math.sin(a*D)*d});
const tolerance=Math.asin((GAP-END)/(2*R))/D;
function make(index){const l=levels[index],rings=l.points.map((p,i)=>({id:p[0],x:p[1],y:p[2],a:p[3],life:'active',color:COLORS[i%COLORS.length]})),by=id=>rings.find(r=>r.id===id);
const rods=l.links.map((e,i)=>{const o=by(e[1]),t=by(e[2]),a=angle(o,t),p=point(o,a),q=point(t,a+180);if(e[0]==='m'){const local=rot({x:p.x-o.x,y:p.y-o.y},-o.a),end=rot({x:q.x-o.x,y:q.y-o.y},-o.a);return{id:'L'+(i+1),kind:'m',owner:o.id,local,end,targets:[t.id]}}return{id:'L'+(i+1),kind:'b',p,q,targets:[o.id,t.id]}});
const s={index,rings,rods,steps:0,states:{},events:[]};update(s);return s;}
const ringCache=new WeakMap;
function ring(s,id){let cache=ringCache.get(s);if(!cache||cache.size!==s.rings.length){cache=new Map(s.rings.map(r=>[r.id,r]));ringCache.set(s,cache)}return cache.get(id)}
function pose(s,z){if(z.kind==='b')return{p:z.p,q:z.q};const r=ring(s,z.owner),p=rot(z.local,r.a),q=rot(z.end,r.a);return{p:{x:r.x+p.x,y:r.y+p.y},q:{x:r.x+q.x,y:r.y+q.y}}}
function exists(s,z){return z.kind==='b'?z.targets.some(id=>ring(s,id)?.life==='active'):ring(s,z.owner).life==='active'}
function endpoints(s,z){const p=pose(s,z);return z.kind==='m'?[{id:z.targets[0],p:p.q}]:[{id:z.targets[0],p:p.p},{id:z.targets[1],p:p.q}]}
function update(s){s.states={};for(const z of s.rods){s.states[z.id]=endpoints(s,z).map(e=>{const r=ring(s,e.id);if(!exists(s,z)||r.life!=='active')return'inactive';if(Math.abs(dist(r,e.p)-R)>.025)return'latched';return Math.abs(diff(r.a,angle(r,e.p)))<=tolerance+1e-8?'aligned':'latched'})}}
function connections(s,id){return s.rods.filter(z=>exists(s,z)).flatMap(z=>endpoints(s,z).map((e,i)=>({z,e,state:s.states[z.id][i],i}))).filter(x=>x.state==='latched'&&(x.e.id===id||x.z.owner===id))}
function settle(s){const removed=[];for(let pass=0;pass<s.rings.length;pass++){update(s);const retained=new Set;for(const z of s.rods){if(!exists(s,z))continue;endpoints(s,z).forEach((e,i)=>{if(s.states[z.id][i]==='latched'){retained.add(e.id);if(z.owner)retained.add(z.owner)}})}const free=s.rings.filter(r=>r.life==='active'&&!retained.has(r.id));if(!free.length)break;for(const r of free){r.life='removed';removed.push(r.id)} }update(s);return removed}
function inRing(p,r,pad=0){const d=dist(p,r);if(d<R-BAND/2-pad||d>R+BAND/2+pad)return false;const gapHalf=Math.asin(GAP/(2*(R-BAND/2)))/D;return Math.abs(diff(angle(r,p),r.a))>Math.max(0,gapHalf-Math.asin(Math.min(1,pad/Math.max(1,d)))/D)}
function samples(p,q,pad=2){const n=Math.ceil(dist(p,q)/2);return Array.from({length:n+1},(_,i)=>({x:p.x+(q.x-p.x)*i/n,y:p.y+(q.y-p.y)*i/n,pad}))}
function rodShapes(s,z){const {p,q}=pose(s,z),a=angle(p,q),u=rot({x:1,y:0},a),v={x:-u.y,y:u.x};let pts=samples(p,q,2.2);
for(const e of endpoints(s,z)){for(const sign of[-1,1]){const c={x:e.p.x+v.x*sign*END/2,y:e.p.y+v.y*sign*END/2};pts.push(...samples({x:c.x-u.x*9,y:c.y-u.y*9},{x:c.x+u.x*9,y:c.y+u.y*9},.8))}for(const sign of[-1,1]){const c={x:e.p.x+u.x*sign*9,y:e.p.y+u.y*sign*9};pts.push(...samples({x:c.x-v.x*END/2,y:c.y-v.y*END/2},{x:c.x+v.x*END/2,y:c.y+v.y*END/2},.8))}}
return pts}
function rodSegments(s,z){const {p,q}=pose(s,z),a=angle(p,q),u=rot({x:1,y:0},a),v={x:-u.y,y:u.x},out=[{p,q,w:2.2}];for(const e of endpoints(s,z)){for(const sign of[-1,1]){const c={x:e.p.x+v.x*sign*END/2,y:e.p.y+v.y*sign*END/2};out.push({p:{x:c.x-u.x*9,y:c.y-u.y*9},q:{x:c.x+u.x*9,y:c.y+u.y*9},w:.8})}for(const sign of[-1,1]){const c={x:e.p.x+u.x*sign*9,y:e.p.y+u.y*sign*9};out.push({p:{x:c.x-v.x*END/2,y:c.y-v.y*END/2},q:{x:c.x+v.x*END/2,y:c.y+v.y*END/2},w:.8})}}return out}
function pointSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function segmentDistance(a,b){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);if(cross(a.p,a.q,b.p)*cross(a.p,a.q,b.q)<0&&cross(b.p,b.q,a.p)*cross(b.p,b.q,a.q)<0)return 0;return Math.min(pointSegment(a.p,b.p,b.q),pointSegment(a.q,b.p,b.q),pointSegment(b.p,a.p,a.q),pointSegment(b.q,a.p,a.q))}
function blockage(s,id){const r=ring(s,id),moving=s.rods.filter(z=>z.owner===id&&exists(s,z));
for(const z of moving){const t=ring(s,z.targets[0]);if(t.life==='active'){const p=pose(s,z).q;if(Math.abs(dist(t,p)-R)>.025)return{kind:'captive',rod:z.id,target:t.id,text:`${id} 的 ${z.id} 活动扣仍套在 ${t.id} 的环体上；对齐也不能强行转出。先处理 ${t.id} 的连接。`}}}
for(const z of s.rods){if(!exists(s,z)||z.owner===id)continue;const pose0=pose(s,z);if(pointSegment(r,pose0.p,pose0.q)>R+BAND/2+12)continue;const contact=endpoints(s,z).find(e=>e.id===id);for(const p of rodShapes(s,z)){if(contact&&dist(p,contact.p)<12)continue;if(inRing(p,r,p.pad))return{kind:'staticRod',rod:z.id,target:id,text:`${id} 环体碰到尚存的 ${z.id} 杆件。已停止，反向退回可用。`}}}
for(const z of moving){const pts=rodShapes(s,z);for(const t of s.rings){if(t.life!=='active'||t.id===id)continue;const zp=pose(s,z);if(pointSegment(t,zp.p,zp.q)>R+BAND/2+12)continue;for(const p of pts){const target=z.targets.includes(t.id),c=pose(s,z).q;if(target&&dist(p,c)<12)continue;if(inRing(p,t,p.pad))return{kind:'ring',rod:z.id,target:t.id,text:`${id} 的完整残留杆 ${z.id} 被 ${t.id} 环体挡住。试着反向转，或先拆 ${t.id}。`}}}
for(const other of s.rods){if(!exists(s,other)||other.owner===id)continue;const zp=pose(s,z),op=pose(s,other);if(segmentDistance({p:zp.p,q:zp.q},{p:op.p,q:op.q})>25)continue;const ops=rodSegments(s,other);for(const p of rodSegments(s,z))for(const q of ops){if(segmentDistance(p,q)<p.w+q.w-.2)return{kind:'rod',rod:z.id,target:other.id,text:`${id} 的杆件 ${z.id} 碰到 ${other.id}。已停在首次接触前，可反向退回。`}}}}
return null;}
function request(s,id,delta){const r=ring(s,id);if(!r||r.life!=='active')return{done:0,removed:[],blocked:null};const old=clone(s),removed=[];let done=0,blocked=null;const sign=Math.sign(delta);for(let remaining=Math.abs(delta);remaining>1e-8;){let step=Math.min(STEP,remaining)*sign;
// Stop exactly at sleeve alignment, rather than skipping a narrow event.
for(const z of s.rods){if(!exists(s,z))continue;for(const e of endpoints(s,z)){if(e.id!==id)continue;const d=diff(angle(r,e.p),r.a);if(d*sign>1e-8&&Math.abs(d)<=Math.abs(step))step=d;}}
const a=r.a;r.a=norm(a+step);blocked=blockage(s,id);if(blocked){r.a=a;update(s);break}done+=step;remaining-=Math.abs(step);removed.push(...settle(s));if(r.life!=='active')break;}
if(Math.abs(done)>.001)s.events.push({id,delta:done,removed});return{done,removed,blocked,before:old}}
function candidates(s){const a=[];for(const z of s.rods){if(!exists(s,z))continue;for(const e of endpoints(s,z)){const r=ring(s,e.id);if(r.life!=='active')continue;const d=diff(angle(r,e.p),r.a);if(Math.abs(d)>.001)for(const delta of[d,d>0?d-360:d+360])a.push({id:r.id,delta,rod:z.id});}}return a}
const key=s=>s.rings.map(r=>r.life==='removed'?'x':Math.round(r.a*10)).join(',');
function solve(initial,budget=450){const visited=new Set;let count=0;function dfs(s){if(s.rings.every(r=>r.life==='removed'))return[];if(++count>budget)return null;const k=key(s);if(visited.has(k))return null;visited.add(k);const opts=[];for(const a of candidates(s)){const c=clone(s),res=request(c,a.id,a.delta);if(res.blocked||Math.abs(res.done)<.001)continue;if(key(c)===k)continue;opts.push({a,c,res,score:res.removed.length*100-Math.abs(res.done)/360})}opts.sort((a,b)=>b.score-a.score);for(const o of opts){if(count>budget)return null;const rest=dfs(o.c);if(rest)return[{...o.a,delta:o.res.done},...rest]}return null}return{path:dfs(clone(initial)),visited:count}}
function validate(s){const errors=[];for(const r of s.rings)for(const t of s.rings){if(r.id<t.id&&dist(r,t)<2*R+BAND)errors.push('环体重叠 '+r.id+t.id)}for(const z of s.rods){for(const e of endpoints(s,z))if(Math.abs(dist(ring(s,e.id),e.p)-R)>.0001)errors.push('活动扣悬空 '+z.id);if(z.kind==='m'&&Math.abs(dist(ring(s,z.owner),pose(s,z).p)-R)>.0001)errors.push('安装悬空 '+z.id)}for(const r of s.rings)if(!connections(s,r.id).length)errors.push('开局意外消除 '+r.id);return errors}
return{R,BAND,GAP,END,D,tolerance,levels,norm,diff,clone,dist,rot,point,angle,make,ring,pose,exists,endpoints,update,connections,settle,request,candidates,solve,validate,blockage};})();
export default Core;

