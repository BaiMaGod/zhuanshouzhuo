// Node-only scene/input contract harness. It does not emulate WebGL or a browser.
export function installHarness(){
 let now=1000,ticks=0;const frames=[],nextFrames=[];const memory=new Map;
 class Graphics{
  ops=[];clear(){this.ops=[]}
  drawRect(...a){this.ops.push(['rect',...a])}drawCircle(...a){this.ops.push(['circle',...a])}
  drawLine(...a){this.ops.push(['line',...a])}drawPoly(...a){this.ops.push(['poly',...a])}
  drawPath(...a){this.ops.push(['path',...a])}drawImage(...a){this.ops.push(['image',a[0].url,...a.slice(1)])}
  drawTriangles(texture,x,y,vertices,uvs,indices){this.ops.push(['mesh',texture.url,x,y,Array.from(vertices),Array.from(uvs),Array.from(indices)])}
 }
 class Sprite{
  constructor(){Object.assign(this,{x:0,y:0,width:0,height:0,rotation:0,alpha:1,visible:true,scaleX:1,scaleY:1,pivotX:0,pivotY:0,zOrder:0,parent:null,children:[],events:{},graphics:new Graphics})}
  pos(x,y){this.x=x;this.y=y;return this}size(w,h){this.width=w;this.height=h;return this}
  scale(x,y=x){this.scaleX=x;this.scaleY=y;return this}pivot(x,y){this.pivotX=x;this.pivotY=y;return this}
  get numChildren(){return this.children.length}
  getChildAt(i){return this.children[i]}
  addChild(c){c.removeSelf();this.children.push(c);c.parent=this;return c}
  removeSelf(){if(this.parent){this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null}return this}
  destroy(children=true){if(children)for(const c of [...this.children])c.destroy(true);this.children=[];this.removeSelf()}
  removeChildren(){for(const c of [...this.children])c.removeSelf()}
  on(e,caller,fn){(this.events[e]??=[]).push(arg=>fn.call(caller,arg));return this}
  off(){return this}click(){for(const f of this.events.click||[])f()}
 }
 class Text extends Sprite{constructor(){super();this.text='';this.fontSize=24;this.align='left';this.valign='top'}}
 class Stage extends Sprite{static SCALE_SHOWALL='showall';static SCREEN_NONE='none'}
 const stage=new Stage,canvas={captured:null,style:{cursor:'auto'},addEventListener(){},getBoundingClientRect(){return{left:0,top:0,width:360,height:640}},setPointerCapture(id){this.captured=id},hasPointerCapture(id){return this.captured===id},releasePointerCapture(){this.captured=null}};
 globalThis.Laya={Config:{useWebGL2:true},Sprite,Text,Stage,Graphics,Rectangle:class {constructor(x,y,width,height){Object.assign(this,{x,y,width,height})}},stage,Event:{CLICK:'click',MOUSE_DOWN:'mousedown',MOUSE_UP:'mouseup',MOUSE_OUT:'mouseout',MOUSE_MOVE:'mousemove',MOUSE_WHEEL:'mousewheel',BLUR:'blur',FOCUS:'focus',VISIBILITY_CHANGE:'visibilitychange',RESIZE:'resize',KEY_DOWN:'keydown'},Ease:{},Browser:{width:360,height:640,clientWidth:360,clientHeight:640,onMobile:false,mainCanvas:{source:canvas}},InputManager:{},LocalStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},SoundManager:{playSound:()=>({stop(){},isStopped:false})},
  init:async()=>{},loader:{load:async()=>{},getRes:url=>({url,width:768,height:768})},
  timer:{frameLoop:(n,caller,fn)=>frames.push(()=>fn.call(caller)),frameOnce:(n,caller,fn)=>{if(caller===null)queueMicrotask(()=>{tick();fn()});else nextFrames.push({at:ticks+n,run:()=>fn.call(caller)})},delta:16,clearAll(){}}};
 globalThis.window=globalThis;globalThis.innerWidth=360;globalThis.innerHeight=640;
 globalThis.location={search:'?debug'};globalThis.document={hidden:false,querySelector:()=>canvas,getElementById:()=>({remove(){}}),addEventListener(){}};
 globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 globalThis.performance={now:()=>now};
 const tick=()=>{now+=16;ticks++;for(const f of frames)f();const ready=nextFrames.filter(f=>f.at<=ticks);for(const f of ready){nextFrames.splice(nextFrames.indexOf(f),1);f.run()}};
 globalThis.requestAnimationFrame=fn=>{queueMicrotask(()=>{tick();fn(now)});return 1};
 const flatten=n=>({
  kind:n instanceof Text?'text':'sprite',x:n.x,y:n.y,w:n.width,h:n.height,
  sx:n.scaleX,sy:n.scaleY,px:n.pivotX,py:n.pivotY,rotation:n.rotation,alpha:n.alpha,visible:n.visible,
  ops:n.graphics.ops,text:n.text,fontSize:n.fontSize,color:n.color,align:n.align,valign:n.valign,
  children:[...n.children].sort((a,b)=>a.zOrder-b.zOrder).map(flatten)
 });
 return{tick,canvas,stage,flatten,get now(){return now}};
}

