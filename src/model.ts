import C0 from './core.js';
import type {CoreAPI,State,Result} from './types.js';
export const Core=C0 as unknown as CoreAPI;
export class GameModel {
 state:State;selected:string|null;history:{state:State;selected:string|null}[]=[];
 constructor(public index:number){this.state=Core.make(index);this.selected=this.first()}
 private first():string|null{return this.state.rings.find(r=>r.life==='active'&&!this.state.rods.some(z=>z.owner===r.id&&Core.ring(this.state,z.targets[0])?.life==='active'))?.id||this.state.rings.find(r=>r.life==='active')?.id||null}
 begin():void{this.history.push({state:Core.clone(this.state),selected:this.selected});if(this.history.length>150)this.history.shift();this.state.steps++}
 turn(id:string,delta:number):Result{
  const res=Core.request(this.state,id,delta);
  if(this.selected&&Core.ring(this.state,this.selected)?.life!=='active')this.selected=this.first();
  // Event history is not part of rule state and must not grow during long dragging.
  this.state.events=this.state.events.slice(-24);
  return res;
 }
 undo():boolean{const h=this.history.pop();if(!h)return false;this.state=h.state;this.selected=h.selected;return true}
 get cleared():boolean{return this.state.rings.every(r=>r.life==='removed')}
}
