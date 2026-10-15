import ImportedCore from './core.js';
import type {Action,CoreAPI,HintGraph,HintNode,State} from './types.js';
const C=ImportedCore as unknown as CoreAPI;
const EPS=.6;
type Motion={id:string;from:number;done:number};
// Immutable DAG metadata is stored on each level, never recomputed for a hint.
export class HintGraphRuntime {
 readonly graph:HintGraph;
 private nodes=new Map<string,HintNode>();
 private dependents=new Map<string,string[]>();
 private remaining=new Map<string,number>();
 private removed=new Set<string>();
 private rods=new Map<string,State['rods'][number]>();
 private cursor=0;
 constructor(index:number,state:State,savedCursor=0){
  const graph=C.levels[index].hintGraph;
  if(!graph)throw Error('Missing level hint graph '+index);
  this.graph=graph;
  for(const ring of state.rings)if(ring.life==='removed')this.removed.add(ring.id);
  for(const rod of state.rods)this.rods.set(rod.id,rod);
  if(graph.kind==='dependency'){
   for(const n of graph.nodes){
    this.nodes.set(n.id,n);
    this.remaining.set(n.id,n.requires.filter(id=>!this.removed.has(id)).length);
    for(const req of n.requires){
     const list=this.dependents.get(req)||[];
     list.push(n.id);this.dependents.set(req,list);
    }
   }
   this.advance(state);
  }else{
   this.cursor=Number.isInteger(savedCursor)?Math.max(0,Math.min(savedCursor,graph.stages.length)):0;
   this.advance(state);
  }
 }
 get progress():number{return this.graph.kind==='stages'?this.cursor:0}
 private advance(state:State):void{
  if(this.graph.kind==='dependency'){
   while(this.cursor<this.graph.order.length&&this.removed.has(this.graph.order[this.cursor]))this.cursor++;
  }else{
   while(this.cursor<this.graph.stages.length){
    const stage=this.graph.stages[this.cursor],ring=C.ring(state,stage.ringId);
    if(!ring||ring.life==='removed'||Math.abs(C.diff(ring.a,stage.targetAngle))<=EPS)this.cursor++;
    else break;
   }
  }
 }
 private crossed(from:number,done:number,target:number):boolean{
  if(Math.abs(done)<.001)return false;
  const along=done>0?C.norm(target-from):C.norm(from-target);
  return along<=Math.abs(done)+EPS;
 }
 observe(state:State,removed:string[]=[],motion?:Motion):void{
  for(const id of removed){
   if(this.removed.has(id))continue;
   this.removed.add(id);
   for(const dependent of this.dependents.get(id)||[])this.remaining.set(dependent,Math.max(0,(this.remaining.get(dependent)||0)-1));
  }
  if(this.graph.kind==='stages'&&motion&&this.cursor<this.graph.stages.length){
   const current=this.graph.stages[this.cursor];
   // Manual reversal of the last completed stage invalidates that checkpoint.
   if(current.ringId!==motion.id)for(let i=this.cursor-1;i>=0;i--){
    const prev=this.graph.stages[i];
    if(prev.ringId!==motion.id)continue;
    const ring=C.ring(state,motion.id);
    if(ring?.life==='active'&&Math.abs(C.diff(ring.a,prev.targetAngle))>EPS)this.cursor=i;
    break;
   }
   const goal=this.graph.stages[this.cursor];
   if(goal?.ringId===motion.id&&this.crossed(motion.from,motion.done,goal.targetAngle))this.cursor++;
  }
  this.advance(state);
 }
 private chooseDelta(state:State,id:string,goal:number):number{
  const ring=C.ring(state,id);if(!ring)return 0;
  const short=C.diff(goal,ring.a);
  if(Math.abs(short)<.001)return 0;
  // Two collision steps per direction, never a full-board DFS or route replay.
  const probe=Math.sign(short)*Math.min(.5,Math.abs(short));
  const first=C.request(C.clone(state),id,probe);
  if(!first.blocked||Math.abs(first.done)>=Math.abs(probe)-.01)return short;
  const other=C.request(C.clone(state),id,-probe);
  return !other.blocked||Math.abs(other.done)>=Math.abs(probe)-.01?(short>0?short-360:short+360):0;
 }
 next(state:State):Action|null{
  this.advance(state);
  if(this.graph.kind==='dependency'){
   const id=this.graph.order[this.cursor],n=id?this.nodes.get(id):null;
   if(!n||(this.remaining.get(id)||0)>0)return null;
   const ring=C.ring(state,id),rod=n.claspId?this.rods.get(n.claspId):null;
   if(!ring||ring.life!=='active'||!rod||!C.exists(state,rod))return null;
   const point=C.endpoints(state,rod).find(e=>e.id===id)?.p;
   if(!point)return null;
   const delta=this.chooseDelta(state,id,C.angle(ring,point));
   return Math.abs(delta)>.001?{id,delta,rod:rod.id}:null;
  }
  const stage=this.graph.stages[this.cursor];if(!stage)return null;
  const ring=C.ring(state,stage.ringId);if(!ring||ring.life!=='active')return null;
  const delta=this.chooseDelta(state,ring.id,stage.targetAngle);
  return Math.abs(delta)>.001?{id:ring.id,delta,rod:'',targetAngle:stage.targetAngle}:null;
 }
}
