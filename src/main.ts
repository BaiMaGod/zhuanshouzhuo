import {Core as C,GameModel} from './model.js';
import {Board} from './renderer.js';
import {text,panel,Button,ornament,COLORS} from './ui.js';
import {Audio} from './audio.js';
import {Save} from './storage.js';
import {JADE_ASSETS,jadeSprite} from './jade.js';
import solutions from './solutions.js';
import type {Action,Point,State,Result} from './types.js';

const W=720,H=Math.round(Math.max(1180,Math.min(1600,innerHeight/Math.min(innerWidth,720)*720)));
const ASSETS=[...JADE_ASSETS,'assets/shadow.png',...['garden','tray','clasp'].map(n=>'assets/art-v3/'+n+'.png')];
class Game {
 root=new Laya.Sprite();scene=new Laya.Sprite();overlay=new Laya.Sprite();
 save=new Save();audio=new Audio();model:GameModel|null=null;board:Board|null=null;
 mode:'home'|'levels'|'game'='home';message:Laya.Text|null=null;status:Laya.Text|null=null;
 controls:Button[]=[];undoButton:Button|null=null;
 drag:{id:string;pointer:number;last:number;started:boolean}|null=null;canvas:HTMLCanvasElement;
 busy=false;epoch=0;worker:Worker|null=null;finishPlan:((path:Action[]|null)=>void)|null=null;
 demoButton:Button|null=null;settled=false;tutorialSeen=false;modalOpen=false;
 constructor(){
  Laya.stage.addChild(this.root);this.root.addChild(this.scene);this.root.addChild(this.overlay);
  this.canvas=document.querySelector('#layaCanvas')||document.querySelector('canvas')!;
  this.audio.enabled=this.save.data.sound;
  this.canvas.addEventListener('pointerdown',e=>this.down(e));
  this.canvas.addEventListener('pointermove',e=>this.move(e));
  this.canvas.addEventListener('pointerup',e=>this.up(e));
  this.canvas.addEventListener('pointercancel',()=>this.releaseDrag());
  this.canvas.addEventListener('lostpointercapture',()=>this.releaseDrag());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.cancel();this.audio.stopAll()}});
  window.addEventListener('blur',()=>{this.releaseDrag();this.audio.stopAll()});
  window.addEventListener('keydown',e=>{
   if(this.mode!=='game'||this.modalOpen)return;
   if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();this.manual((e.key==='ArrowLeft'?-1:1)*(e.shiftKey?30:1))}
   if(e.key==='Escape'){this.cancel();this.hideModal()}
  });
  Laya.timer.frameLoop(1,this,this.tick);this.home();
 }
 background():void{
  const bg=new Laya.Sprite();bg.graphics.drawImage(Laya.loader.getRes('assets/art-v3/garden.png'),0,0,W,H);bg.mouseEnabled=false;this.scene.addChild(bg);
 }
 clear(mode:Game['mode']):void{
  this.cancel();this.board?.destroy();this.board=null;this.model=null;
  this.scene.destroy(true);this.scene=new Laya.Sprite();this.root.addChild(this.scene);this.scene.zOrder=0;
  this.overlay.zOrder=50;this.hideModal();this.controls=[];this.undoButton=null;this.message=null;this.status=null;this.demoButton=null;
  this.mode=mode;this.background();
 }
 image(parent:Laya.Sprite,url:string,x:number,y:number,w:number,h:number,rotation=0):Laya.Sprite{
  const s=new Laya.Sprite();s.pos(x,y);s.graphics.drawImage(Laya.loader.getRes(url),-w/2,-h/2,w,h);s.rotation=rotation;s.mouseEnabled=false;parent.addChild(s);return s;
 }
 home():void{
  this.clear('home');
  text(this.scene,'一盘温润玉色 · 十重巧妙机关',70,115,580,42,22,COLORS.muted);
  text(this.scene,'转手镯消除',35,180,650,90,64,COLORS.ink,'center',true);
  text(this.scene,'玉 环 十 境',100,273,520,48,28,COLORS.gold,'center',true);
  ornament(this.scene,220,345,280);
  const cy=H*.51;
  this.image(this.scene,'assets/art-v3/tray.png',360,cy,600,570);
  this.image(this.scene,'assets/shadow.png',290,cy-12,320,320,-42).alpha=.16;
  this.scene.addChild(jadeSprite('amber',290,cy-18,320/110,-42));
  this.image(this.scene,'assets/shadow.png',447,cy+100,290,290,150).alpha=.16;
  this.scene.addChild(jadeSprite('peach',447,cy+93,290/110,150));
  text(this.scene,'轻转玉环，解开环环相扣',80,H-350,560,46,28,COLORS.ink,'center',true);
  this.scene.addChild(new Button(this.save.data.unlocked?'继续 · 第 '+(this.save.data.unlocked+1)+' 境':'入境解镯',130,H-272,460,86,()=>this.load(this.save.data.unlocked),true));
  this.scene.addChild(new Button('十境图谱',220,H-155,280,64,()=>this.levels()));
  text(this.scene,'无计时压力 · 从最简单的一扣开始',85,H-70,550,32,18,COLORS.muted);
 }
 levels():void{
  this.clear('levels');
  this.scene.addChild(new Button('‹ 返回',32,34,130,62,()=>this.home()));
  text(this.scene,'十境图谱',190,45,340,65,42,COLORS.ink,'center',true);
  const count=Object.keys(this.save.data.records).length;
  text(this.scene,'已解 '+count+' / 10 境 · 依次入境，渐识机关',75,142,570,40,23,COLORS.muted);
  ornament(this.scene,185,204,350);
  const names=C.levels.map(l=>l.name),sy=245,cell=Math.min(172,(H-340)/5);
  for(let i=0;i<10;i++){
   const x=i%2?378:45,y=sy+Math.floor(i/2)*cell,open=i<=this.save.data.unlocked,done=this.save.data.records[i];
   const b=new Button('',x,y,296,cell-20,()=>this.load(i));
   b.enabled=open;this.scene.addChild(b);
   text(b,String(i+1).padStart(2,'0'),18,14,58,53,32,open?COLORS.gold:COLORS.muted,'center',true);
   text(b,names[i],85,18,190,45,28,open?COLORS.ink:COLORS.muted,'left',true);
   text(b,done?'✦'.repeat(done.stars):open?'点击入境':'通关前一境解锁',20,cell-88,256,46,22,done?COLORS.gold:COLORS.muted);
  }
  text(this.scene,'玉色各异，机关循序渐进',90,H-65,540,32,18,COLORS.muted);
 }
 load(i:number):void{
  if(i<0||i>this.save.data.unlocked)return;
  this.clear('game');this.settled=false;this.model=new GameModel(i);
  panel(this.scene,105,105,510,113,26,'rgba(255,251,232,0.94)','#cdb37b');
  this.scene.addChild(new Button('‹ 图谱',28,26,136,60,()=>this.levels()));
  const sound=new Button(this.audio.enabled?'音效 开':'音效 关',456,26,116,60,()=>{
   this.audio.enabled=!this.audio.enabled;this.save.data.sound=this.audio.enabled;this.save.persist();sound.label.text=this.audio.enabled?'音效 开':'音效 关';this.audio.play('select');
  });this.scene.addChild(sound);
  this.scene.addChild(new Button('玩法',586,26,106,60,()=>this.help()));
  text(this.scene,'第 '+String(i+1).padStart(2,'0')+' 境 · '+C.levels[i].name,50,110,620,64,39,COLORS.ink,'center',true);
  this.status=text(this.scene,'',70,179,580,38,21,COLORS.muted);
  ornament(this.scene,176,229,368);
  const plateH=H-616;
  this.image(this.scene,'assets/art-v3/tray.png',360,246+plateH/2,710,plateH);
  this.board=new Board(this.scene,{x:73,y:288,w:574,h:H-678});this.board.load(this.model.state);
  panel(this.scene,35,H-366,650,109,22,'rgba(255,250,229,0.94)','#d4bf90');
  this.message=text(this.scene,C.levels[i].tip,52,H-354,616,94,22,COLORS.ink);
  const y=H-240;
  const specs:[string,number,number,boolean][]=[['↶ 30°',32,-30,false],['↶ 微调',197,-1,true],['微调 ↷',362,1,true],['30° ↷',527,30,false]];
  for(const [title,x,d,primary] of specs){const b=new Button(title,x,y,160,68,()=>this.manual(d),primary);this.controls.push(b);this.scene.addChild(b)}
  this.undoButton=new Button('撤销',32,H-143,145,65,()=>this.undo());this.scene.addChild(this.undoButton);
  this.scene.addChild(new Button('重开',197,H-143,145,65,()=>this.load(i)));
  this.scene.addChild(new Button('提示',362,H-143,145,65,()=>void this.hint()));
  this.demoButton=new Button('演示',527,H-143,160,65,()=>{if(this.busy)this.cancel();else void this.automatic(true)});this.scene.addChild(this.demoButton);
  text(this.scene,'拖动环体旋转 · 松手靠近扣位可轻吸附',55,H-55,610,32,18,COLORS.muted);
  this.sync();
  if(i===0&&!this.tutorialSeen&&!this.save.data.records[0]){
   this.tutorialSeen=true;
   this.modal('先解这一扣',['拖动 B 的玉环，让细缺口转向空心扣。','A 上的实心座固定在 A 上，不能用 A 的缺口解开。','对齐后手镯会自动消除。'],[{label:'开始转动 B',action:()=>this.hideModal(),primary:true}]);
  }
 }
 say(content:string):void{if(this.message)this.message.text=content}
 sync():void{
  if(!this.model||!this.board)return;
  const s=this.model.state,n=s.rings.filter(r=>r.life==='active').length;
  this.status!.text=n+' 镯待解  ·  '+s.steps+' 次转动'+(this.model.selected?'  ·  选中 '+this.model.selected:'');
  this.board.selected=this.model.selected;this.board.draw(s);
  this.controls.forEach(b=>b.enabled=!this.busy&&!this.board!.animating&&!!this.model!.selected&&!this.modalOpen);
  if(this.undoButton)this.undoButton.enabled=this.model.history.length>0&&!this.modalOpen;
  if(this.demoButton)this.demoButton.label.text=this.busy?'停止':'演示';
 }
 releaseDrag():void{
  this.audio.stopMotion();this.audio.resetContact();
  const d=this.drag;this.drag=null;
  if(d)try{if(this.canvas.hasPointerCapture(d.pointer))this.canvas.releasePointerCapture(d.pointer)}catch{}
 }
 cancel():void{
  this.audio.stopAll();
  this.epoch++;this.busy=false;this.releaseDrag();
  this.worker?.terminate();this.worker=null;
  this.finishPlan?.(null);this.finishPlan=null;
  if(this.demoButton)this.demoButton.label.text='演示';
  this.sync();
 }
 point(e:PointerEvent):Point{
  const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};
 }
 down(e:PointerEvent):void{
  this.audio.wake();
  if(this.mode!=='game'||!this.model||!this.board||this.busy||this.board.animating||this.modalOpen)return;
  const p=this.point(e),ring=this.board.pick(p,this.model.state);if(!ring)return;
  this.model.selected=ring.id;this.board.hint=null;
  this.drag={id:ring.id,pointer:e.pointerId,last:C.angle(ring,this.board.toWorld(p)),started:false};
  this.canvas.setPointerCapture(e.pointerId);this.audio.play('select');this.sync();
 }
 move(e:PointerEvent):void{
  const d=this.drag;if(!d||d.pointer!==e.pointerId||!this.model||!this.board||this.busy||this.board.animating)return;
  const r=C.ring(this.model.state,d.id);if(!r||r.life!=='active'){this.releaseDrag();return}
  const p=this.board.toWorld(this.point(e));
  // Ignore dragging through the center, where angle changes become undefined.
  if(C.dist(p,r)<15)return;
  const a=C.angle(r,p),delta=C.diff(a,d.last);d.last=a;
  if(Math.abs(delta)<.08)return;
  if(!d.started){this.model.begin();d.started=true}
  this.perform(d.id,delta);
 }
 up(e:PointerEvent):void{
  if(!this.drag||this.drag.pointer!==e.pointerId)return;const d=this.drag;this.releaseDrag();
  if(d.started&&!this.busy&&!this.board?.animating)this.snap(d.id);
 }
 snap(id:string):void{
  if(!this.model)return;const s=this.model.state,r=C.ring(s,id);if(!r||r.life!=='active')return;
  let best=5;
  for(const z of s.rods)if(C.exists(s,z))for(const e of C.endpoints(s,z))if(e.id===id){
   const d=C.diff(C.angle(r,e.p),r.a);if(Math.abs(d)<Math.abs(best))best=d;
  }
  if(Math.abs(best)<=4)this.perform(id,best);
 }
 manual(delta:number):void{
  if(!this.model||!this.model.selected||this.busy||this.board?.animating||this.modalOpen)return;
  this.audio.resetContact();this.model.begin();this.board!.hint=null;this.perform(this.model.selected,delta);
 }
 perform(id:string,d:number):Result{
  const model=this.model!,before=C.clone(model.state),res=model.turn(id,d);
  if(res.done){this.audio.motion(res.done);if(!res.blocked)this.audio.resetContact()}
  if(res.removed.length){
   this.releaseDrag();this.board!.release(before,model.state,res.removed);this.audio.play('clear');
   this.say(res.removed.join('、')+' 已解开。观察下一只手镯的扣位。');
  }else if(res.blocked){
   this.board!.blocked=res.blocked;this.board!.blockUntil=performance.now()+550;
   this.audio.collision(id+':'+res.blocked.rod+':'+res.blocked.target,Math.min(1,Math.abs(d)/8));
   this.say(res.blocked.kind==='captive'?id+' 的锁杆还套在 '+res.blocked.target+' 上，先处理 '+res.blocked.target+'。':id+' 的锁杆被挡住了。试试反向转动，或先拆旁边的手镯。');
  }else{
   const aligned=model.state.rods.some(z=>C.exists(model.state,z)&&C.endpoints(model.state,z).some((e,j)=>e.id===id&&model.state.states[z.id][j]==='aligned'));
   if(aligned){this.say(id+' 已对齐，保持这个位置，再调整其他扣位。');this.audio.play('align')}
  }
  this.sync();return res;
 }
 undo():void{
  if(!this.model?.history.length)return;this.cancel();
  if(this.model.undo()){
   this.hideModal();this.settled=false;this.board!.load(this.model.state);
   this.say('已撤销，玉环和完整锁杆一起恢复。');this.sync();
  }
 }
 plan():Promise<Action[]|null>{
  if(!this.model)return Promise.resolve(null);
  // Verified startup paths avoid unnecessary search; changed states use the same solver in a worker.
  const initial=C.make(this.model.index),s=this.model.state;
  if(s.rings.every((r,i)=>r.life===initial.rings[i].life&&Math.abs(C.diff(r.a,initial.rings[i].a))<1e-7))return Promise.resolve(C.clone(solutions[this.model.index]) as Action[]);
  return new Promise(resolve=>{
   let timeout:ReturnType<typeof setTimeout>;
   const finish=(p:Action[]|null)=>{clearTimeout(timeout);this.worker?.terminate();this.worker=null;this.finishPlan=null;resolve(p)};
   this.finishPlan=finish;
   try{
    this.worker=new Worker(new URL('./solver-worker.js',import.meta.url),{type:'module'});
    this.worker.onmessage=e=>finish(e.data.path||null);
    this.worker.onerror=()=>finish(null);
    timeout=setTimeout(()=>finish(null),20000);this.worker.postMessage(C.clone(s));
   }catch{finish(null)}
  });
 }
 async hint():Promise<void>{
  if(this.busy||this.modalOpen||this.board?.animating||!this.model)return;
  this.busy=true;const token=++this.epoch;this.say('正在观察当前扣位…');this.sync();
  const path=await this.plan();if(token!==this.epoch)return;
  this.busy=false;
  if(!path?.length){this.say('这一步还没找到路线。可以撤销或重开，再观察连接。');this.sync();return}
  const a=path[0];this.model.selected=a.id;
  const z=this.model.state.rods.find(z=>z.id===a.rod)!;
  this.board!.hint=C.endpoints(this.model.state,z).find(e=>e.id===a.id)?.p||null;
  this.say('先转 '+a.id+'，'+(a.delta>0?'顺时针':'逆时针')+'让缺口对准闪光的空心扣。');this.sync();
  this.modal('看这一只玉环',['已标出 '+a.id+' 的目标扣位。','提示只指出路线；自动对准也会沿合法路径转动。'],[
   {label:'我来转',action:()=>this.hideModal(),primary:true},
   {label:'对准这一扣',action:()=>{this.hideModal();void this.automatic(false)},primary:false}
  ]);
 }
 async automatic(all:boolean):Promise<void>{
  if(this.busy||this.modalOpen||this.board?.animating||!this.model)return;
  this.busy=true;const token=++this.epoch;this.say('正在寻找合法旋转路线…');this.sync();
  const full=await this.plan();if(token!==this.epoch)return;
  if(!full?.length){this.busy=false;this.say('当前没有找到路线。可撤销或重开。');this.sync();return}
  const path=all?full:full.slice(0,1);
  for(const a of path){
   if(token!==this.epoch||!this.model||!this.board)return;
   this.model.selected=a.id;this.model.begin();this.say('转动 '+a.id+'，对齐空心扣…');
   let remaining=a.delta;
   while(Math.abs(remaining)>.001){
    if(token!==this.epoch)return;
    const amount=Math.sign(remaining)*Math.min(2.4,Math.abs(remaining));
    const res=this.perform(a.id,amount);remaining-=res.done;
    if(res.blocked||Math.abs(res.done)<.001){this.busy=false;this.sync();return}
    if(C.ring(this.model.state,a.id)?.life!=='active')break;
    await new Promise<void>(r=>requestAnimationFrame(()=>r()));
   }
   while(this.board.animating){if(token!==this.epoch)return;await new Promise<void>(r=>requestAnimationFrame(()=>r()))}
  }
  if(token!==this.epoch)return;this.busy=false;this.sync();
 }
 tick():void{
  this.audio.tick(performance.now());
  if(!this.model||!this.board||this.mode!=='game')return;
  if(this.board.animating||this.board.sparks.length||this.board.hint||performance.now()<this.board.blockUntil)this.board.draw(this.model.state);
  this.controls.forEach(b=>b.enabled=!this.busy&&!this.board!.animating&&!!this.model!.selected&&!this.modalOpen);
  if(this.model.cleared&&!this.board.animating&&!this.busy&&!this.settled){this.settled=true;this.win()}
 }
 win():void{
  if(!this.model)return;const i=this.model.index,steps=this.model.state.steps;
  const stars=this.save.win(i,steps,solutions[i].length);this.audio.play('win');
  this.modal(i===9?'十境皆通':'这一境，解开了',['✦'.repeat(stars),C.levels[i].name+' · '+steps+' 次转动',i===9?'玉环十境全部完成，随时回来再解。':'下一境已开启，机关会再多一点变化。'],[
   {label:i===9?'回到十境图谱':'进入第 '+(i+2)+' 境',action:()=>i===9?this.levels():this.load(i+1),primary:true},
   {label:'再解一次',action:()=>this.load(i),primary:false}
  ]);
 }
 help():void{
  this.cancel();this.modal('转动之前，先看两端',[
   '实心座固定在所属玉环上，完整锁杆随所属镯合法旋转和消除。',
   '空心扣用被扣住的玉环缺口对齐。带 × 锚点的杆固定在背景，两端分别判断。',
   '对齐后转离会重新扣合。多条连接要保持对齐，零有效扣合才消除。',
   '旁边的玉环消除后，尚存所属镯的完整杆仍在；遇到阻挡就停住。'
  ],[{label:'继续拆解',action:()=>this.hideModal(),primary:true}]);
 }
 modal(title:string,lines:string[],actions:{label:string;action:()=>void;primary:boolean}[]):void{
  this.hideModal();this.modalOpen=true;this.releaseDrag();
  const shade=new Laya.Sprite();shade.size(W,H);shade.graphics.drawRect(0,0,W,H,'rgba(47,63,41,0.36)');shade.mouseEnabled=true;
  shade.on(Laya.Event.CLICK,this,()=>{});this.overlay.addChild(shade);
  const height=Math.min(H-150,250+lines.length*85+actions.length*84),card=panel(this.overlay,50,(H-height)/2,620,height,32,'#fff9e8','#c5aa71');
  card.mouseEnabled=true;card.on(Laya.Event.CLICK,this,()=>{});
  text(card,title,30,28,560,68,37,COLORS.ink,'center',true);ornament(card,160,117,300);
  let y=139;
  for(const line of lines){text(card,line,40,y,540,78,line.startsWith('✦')?40:23,line.startsWith('✦')?COLORS.gold:COLORS.ink);y+=85}
  for(const a of actions){card.addChild(new Button(a.label,60,y,500,64,a.action,a.primary));y+=84}
  this.sync();
 }
 hideModal():void{
  this.overlay.destroy(true);this.overlay=new Laya.Sprite();this.overlay.zOrder=50;this.root.addChild(this.overlay);this.modalOpen=false;
  if(this.model&&this.board)this.sync();
 }
}
async function boot():Promise<void>{
 await Laya.init(W,H);Laya.stage.scaleMode=Laya.Stage.SCALE_SHOWALL;Laya.stage.screenMode=Laya.Stage.SCREEN_NONE;
 Laya.stage.alignH='center';Laya.stage.alignV='middle';Laya.stage.bgColor='#e6debf';
 await Laya.loader.load(ASSETS);const g=new Game();await g.audio.load();document.getElementById('boot')?.remove();
 if(new URLSearchParams(location.search).has('debug')){
  (window as unknown as {jadeDebug:unknown}).jadeDebug={game:g,Core:C,getState:()=>g.model?C.clone(g.model.state):null};
 }
}
boot().catch(e=>{
 console.error(e);const box=document.getElementById('boot');
 if(box){box.classList.add('error');box.textContent='玉盘暂时没有加载完成，请刷新再试。'}
});
