// Optional 101–200 mechanics. No existing formal level enables this until
// its entire geometry and physical route have passed publication gates.
const ADJACENT=92.0001;
const near=(a,b)=>Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-ADJACENT)<0.05;
const own=(array,id)=>array.find(item=>item.id===id);
const attributeBurst=a=>a==='burst'||a==='burst+silk';
const attributeSilk=a=>a==='silk'||a==='burst+silk';

export function prepareSpecial(s,level){
 const special=level.special;
 if(!special)return;
 const attributes=new Map((special.rings||[]).map(r=>[r.id,r]));
 for(const ring of s.rings){
  const entry=attributes.get(ring.id);
  ring.attribute=entry?.attribute||'ordinary';
  ring.burst=attributeBurst(ring.attribute);
  ring.silkRemaining=attributeSilk(ring.attribute)?entry.silkLayers:0;
 }
 s.special={
  silkEdges:(special.silkEdges||[]).map(e=>({sourceId:e.sourceId,targetId:e.targetId})),
  processedRemovals:[]
 };
}
export function processSpecialRemoval(s,removedIds){
 if(!s.special||!removedIds.length)return;
 const processed=new Set(s.special.processedRemovals);
 for(const id of removedIds){
  if(processed.has(id))continue;
  processed.add(id);
  const source=own(s.rings,id);
  if(!source)continue;
  for(const edge of s.special.silkEdges){
   if(edge.sourceId!==id)continue;
   const target=own(s.rings,edge.targetId);
   if(!target||target.life!=='active'||!near(source,target))continue;
   if((target.silkRemaining||0)>0){
    target.silkRemaining--;
    s.events.push({kind:'silk-release',source:id,target:target.id,remaining:target.silkRemaining});
   }
  }
  if(!source.burst)continue;
  const neighborIds=new Set(s.rings.filter(r=>r.life==='active'&&near(source,r)).map(r=>r.id));
  if(!neighborIds.size)continue;
  const broken=[];
  for(const rod of s.rods){
   if(rod.broken)continue;
   // A whole background multihead piece breaks when any of its live heads
   // is hit. An owner-mounted rod breaks when either attached side is hit.
   if(!neighborIds.has(rod.owner)&&!rod.targets.some(t=>neighborIds.has(t)))continue;
   if(rod.kind==='m'&&own(s.rings,rod.owner)?.life!=='active')continue;
   if(rod.kind==='b'&&!rod.targets.some(t=>own(s.rings,t)?.life==='active'))continue;
   rod.broken=true;
   broken.push(rod.id);
  }
  s.events.push({kind:'burst',source:id,brokenRodIds:broken});
 }
 s.special.processedRemovals=[...processed];
}
export function validateSpecial(s){
 const errors=[],cfg=s.special;
 if(!cfg)return errors;
 const rings=new Map(s.rings.map(r=>[r.id,r])),sourceKeys=new Set(),layerCount=new Map;
 for(const e of cfg.silkEdges){
  const from=rings.get(e.sourceId),to=rings.get(e.targetId);
  if(!from||!to||from===to){errors.push('解缠来源无效 '+e.sourceId+'→'+e.targetId);continue}
  if(!near(from,to))errors.push('解缠来源不相邻 '+e.sourceId+'→'+e.targetId);
  const key=e.sourceId+':'+e.targetId;
  if(sourceKeys.has(key))errors.push('重复解缠来源 '+key);
  sourceKeys.add(key);layerCount.set(e.targetId,(layerCount.get(e.targetId)||0)+1);
 }
 for(const r of s.rings){
  const expected=layerCount.get(r.id)||0,amount=r.silkRemaining||0;
  if(expected!==amount)errors.push('缠丝层数不一致 '+r.id+' expected='+expected+' actual='+amount);
  if(!Number.isInteger(amount)||amount<0||amount>3)errors.push('非法缠丝层数 '+r.id);
  if(r.burst!==attributeBurst(r.attribute))errors.push('爆裂属性不一致 '+r.id);
 }
 return errors;
}
// A challenge duration is never inferred from the number of bracelets,
// connections or background heads: S must be a validated full route.
export function challengeDuration({steps,secondsPerStep,thinkingSeconds,routeVerified}){
 if(routeVerified!==true||!Number.isInteger(steps)||steps<=0)throw Error('缺少已验证的完整无道具操作路线');
 if(!Number.isFinite(secondsPerStep)||secondsPerStep<=0||!Number.isFinite(thinkingSeconds)||thinkingSeconds<0)throw Error('非法限时参数');
 return 5*Math.ceil((steps*secondsPerStep+thinkingSeconds)/5);
}
