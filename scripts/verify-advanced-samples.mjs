#!/usr/bin/env node
// Release gate: uses exactly the game Core.request continuous .25-degree steps.
// Never reports geometry or a complete route as verified from quotas alone.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import C from '../dist/js/core.js';
import {compileApprovedSample} from '../dist/js/advanced-level-compiler.js';
import {trayFit,TRAY_SURFACE,RING_ENVELOPE} from '../dist/js/tray-layout.js';
const file=process.argv[2];
if(!file){console.error('Usage: npm run levels:verify-advanced -- <filled-samples.json>');process.exit(2)}
const data=JSON.parse(readFileSync(file,'utf8'));
const specs=data.levels||[];
if(!Array.isArray(specs)||specs.length===0){console.error('No advanced level specs');process.exit(2)}
const hash=s=>createHash('sha256').update(JSON.stringify({
 rings:s.rings.map(r=>[r.id,r.x,r.y,r.a,r.life,r.attribute,r.silkRemaining]),
 rods:s.rods.map(z=>[z.id,z.kind,z.owner,z.targets,z.broken===true]),
 processed:s.special?.processedRemovals||[]
})).digest('hex');
function checkTray(rings){
 const center={x:(Math.min(...rings.map(r=>r.x))+Math.max(...rings.map(r=>r.x)))/2,
  y:(Math.min(...rings.map(r=>r.y))+Math.max(...rings.map(r=>r.y)))/2};
 for(const height of [936,1200]){
  const zoom=trayFit(rings,center,710,height);
  for(const r of rings)for(let degree=0;degree<360;degree+=15){
   const a=degree*Math.PI/180;
   const x=(r.x-center.x+RING_ENVELOPE*Math.cos(a))*zoom/(710*TRAY_SURFACE.rx);
   const y=(r.y-center.y+RING_ENVELOPE*Math.sin(a))*zoom/(height*TRAY_SURFACE.ry);
   if(x*x+y*y>1+1e-6)throw Error('Ring outside jade tray: '+r.id);
  }
 }
}
let checked=0;
for(const spec of specs){
 let level;
 try{level=compileApprovedSample(spec)}
 catch(e){throw Error('Level '+spec.level+' is NOT publishable: '+e.message)}
 const index=C.levels.push(level)-1;
 try{
  const s=C.make(index),errors=C.validate(s);
  if(errors.length)throw Error('Physics geometry: '+errors.slice(0,8).join(' | '));
  checkTray(s.rings);
  if(C.settle(C.clone(s)).length)throw Error('Board clears before a player action');
  const initial=hash(s);
  if(initial!==spec.verifiedRoute.initialStateHash)throw Error('Initial state hash mismatch; resimulate');
  for(const [i,action] of spec.verifiedRoute.orderedSteps.entries()){
   const ring=C.ring(s,action.id);
   if(!ring||ring.life!=='active')throw Error('Step '+(i+1)+' references an inactive ring');
   const result=C.request(s,action.id,action.delta);
   if(result.blocked)throw Error('Step '+(i+1)+' collision '+JSON.stringify(result.blocked));
   if(Math.abs(result.done)<.001)throw Error('Step '+(i+1)+' did not rotate');
  }
  if(s.rings.some(r=>r.life==='active'))throw Error('Incomplete route');
  if(s.rods.some(z=>C.exists(s,z)))throw Error('Clasp remains after victory');
  if(hash(s)!==spec.verifiedRoute.finalStateHash)throw Error('Final state hash mismatch');
  checked++;
  console.log('PASS '+spec.level+' | rings '+s.rings.length+' | steps '+spec.verifiedRoute.stepsS);
 }finally{C.levels.pop()}
}
console.log('All '+checked+' advanced sample routes passed physical replay.');
