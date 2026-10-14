import {Core as C,GameModel} from './model.js';
import {Board} from './renderer.js';
import {text,panel,Button,ornament,COLORS,icon} from './ui.js';
import {Guide} from './guide.js';
import {Audio} from './audio.js';
import {Save} from './storage.js';
import {JADE_ASSETS,jadeSprite} from './jade.js';
import solutions from './solutions.js';
import {TEACHING_COUNT,FORMAL_INDEX} from './levels.js';
import type {Action,Point,State,Result} from './types.js';

const W=720,H=Math.round(Math.max(1180,Math.min(1600,innerHeight/Math.min(innerWidth,720)*720)));
// Keep UI and hit coordinates at 720 logical units, but bound mobile pixel fill.
const RENDER_W=innerWidth<600?Math.min(W,Math.round(innerWidth*1.5)):W;
const RENDER_SCALE=RENDER_W/W;
const ASSETS=[...JADE_ASSETS,'assets/shadow.png',...['garden','tray','clasp'].map(n=>'assets/art-v3/'+n+'.png')];
class Game {
 root=new Laya.Sprite();scene=new Laya.Sprite();overlay=new Laya.Sprite();
 garden:Laya.Sprite|null=null;
 save=new Save();audio=new Audio();model:GameModel|null=null;board:Board|null=null;
 mode:'home'|'levels'|'game'='home';message:Laya.Text|null=null;status:Laya.Text|null=null;
 controls:Button[]=[];undoButton:Button|null=null;
 pointers=new Map<number,Point>();panMode=false;viewLabel:Laya.Text|null=null;panButton:Button|null=null;
 viewGesture:{kind:'pinch'|'pan';start:Point;screen:Point;zoom:number;distance:number;anchor:Point}|null=null;
 get formal():boolean{return this.model?.index===FORMAL_INDEX}
 drag:{id:string;pointer:number;last:number;started:boolean}|null=null;canvas:HTMLCanvasElement;
 busy=false;epoch=0;worker:Worker|null=null;finishPlan:((path:Action[]|null)=>void)|null=null;
 demoButton:Button|null=null;settled=false;tutorialSeen=false;modalOpen=false;
 guide:Guide|null=null;guideTitle:Laya.Text|null=null;guideSkip:Button|null=null;homePreview:Board|null=null;homeSpark:Laya.Sprite|null=null;lastHomeFrame=0;
 constructor(){
  this.root.scale(RENDER_SCALE,RENDER_SCALE);
  Laya.stage.addChild(this.root);this.root.addChild(this.scene);this.root.addChild(this.overlay);
  this.canvas=document.querySelector('#layaCanvas')||document.querySelector('canvas')!;
  this.audio.enabled=this.save.data.sound;Button.feedback=()=>{this.audio.wake();this.audio.play('select')};
  this.canvas.addEventListener('pointerdown',e=>this.down(e));
  this.canvas.addEventListener('pointermove',e=>this.move(e));
  this.canvas.addEventListener('pointerup',e=>this.up(e));
  this.canvas.addEventListener('pointercancel',()=>this.releasePointers());
  this.canvas.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))this.releasePointers()});
  this.canvas.addEventListener('wheel',e=>{if(this.mode!=='game'||!this.board||this.modalOpen||this.busy)return;const p=this.point(e);if(!this.board.contains(p))return;e.preventDefault();this.releasePointers();this.board.zoomTo(this.board.zoom*Math.exp(-e.deltaY*.0015),p);this.syncView()},{passive:false});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.cancel();this.audio.stopAll()}});
  window.addEventListener('blur',()=>{this.releasePointers();this.audio.stopAll()});
  window.addEventListener('keydown',e=>{
   if(this.mode!=='game'||this.modalOpen)return;
   if(e.key==='Escape'){this.cancel();this.hideModal()}
  });
  Laya.timer.frameLoop(1,this,this.tick);this.home();
 }
 background():void{
  const bg=new Laya.Sprite();bg.name='board-garden';bg.graphics.drawImage(Laya.loader.getRes('assets/art-v3/garden.png'),0,0,W,H);
  if(this.mode==='game'){bg.graphics.drawRect(0,0,W,H,'rgba(239,239,218,0.40)');bg.graphics.drawRect(0,0,W,H,'rgba(37,66,52,0.10)')}
  bg.mouseEnabled=false;this.scene.addChild(bg);this.garden=bg;
 }
 clear(mode:Game['mode']):void{
  this.cancel();this.guide?.destroy();this.guide=null;this.guideTitle=null;this.guideSkip=null;this.homePreview?.destroy();this.homePreview=null;this.homeSpark=null;this.board?.destroy();this.board=null;this.model=null;
  this.scene.destroy(true);this.scene=new Laya.Sprite();this.root.addChild(this.scene);this.scene.zOrder=0;
  this.overlay.zOrder=50;this.hideModal();this.controls=[];this.undoButton=null;this.message=null;this.status=null;this.demoButton=null;this.viewLabel=null;this.panButton=null;this.panMode=false;
  // Keep render-pass topology stable through zoom, undo and restart.
  this.scene.size(W,H);this.scene.cacheAs=mode==='game'?'bitmap':'none';
  // The camera also moves the artwork. Clip its expanded bounds to the screen.
  if(mode==='game')this.scene.scrollRect=new Laya.Rectangle(0,0,W,H);
  this.mode=mode;this.background();
 }
 image(parent:Laya.Sprite,url:string,x:number,y:number,w:number,h:number,rotation=0):Laya.Sprite{
  const s=new Laya.Sprite();s.pos(x,y);s.graphics.drawImage(Laya.loader.getRes(url),-w/2,-h/2,w,h);s.rotation=rotation;s.mouseEnabled=false;parent.addChild(s);return s;
 }
 home():void{
  this.clear('home');
  const teaching=Object.entries(this.save.data.records).filter(([i])=>Number(i)<TEACHING_COUNT),completed=teaching.length,stars=teaching.reduce((n,[,r])=>n+r.stars,0);
  const badge=panel(this.scene,34,30,244,58,28,'#fff5d3','#c9a655');icon(badge.graphics,'star',15,15,26,COLORS.gold);
  text(badge,'教学 '+completed+' / 10 境',47,0,183,58,22);
  this.scene.addChild(new Button('',608,28,76,66,()=>this.settings(),false,'settings'));
  text(this.scene,'玉  环  十  境',100,128,520,52,26,COLORS.gold,'center',true);
  const shadow=text(this.scene,'转手镯消除',37,201,650,108,76,'#bc9e63','center',true);shadow.bold=true;
  const title=text(this.scene,'转手镯消除',35,195,650,108,76,'#2f5947','center',true);title.bold=true;
  text(this.scene,'转一转，解开环环相扣',80,311,560,50,26,COLORS.ink,'center',true);ornament(this.scene,235,384,250);
  const cy=370+(H-870)/2,plateH=H-880;
  this.image(this.scene,'assets/art-v3/tray.png',360,cy,670,Math.max(410,plateH+110));
  this.homePreview=new Board(this.scene,{x:112,y:cy-126,w:496,h:265});
  const state=C.make(0);this.homePreview.load(state);this.homePreview.selected='B';this.homePreview.draw(state);
  this.homeSpark=new Laya.Sprite();this.homeSpark.mouseEnabled=false;this.scene.addChild(this.homeSpark);
  const seal=panel(this.scene,230,cy+142,260,52,25,'#fff5d8','#c7a15a');
  text(seal,'一扣入门 · 十境解谜',12,0,236,52,21,COLORS.ink,'center',true);
  text(this.scene,'正式关卡 · 54 镯 · 超级困难',80,H-463,560,40,23,COLORS.gold);
  this.scene.addChild(new Button('挑战九宫锁玉阵',112,H-407,496,80,()=>this.load(FORMAL_INDEX),true,'play'));
  this.scene.addChild(new Button(completed?'继续解镯':'开始解镯',112,H-296,496,100,()=>this.load(this.save.data.unlocked),true,'play'));
  this.scene.addChild(new Button('关卡图谱',116,H-164,234,70,()=>this.levels(),false,'map'));
  this.scene.addChild(new Button('新手练习',370,H-164,234,70,()=>this.practice(),false,'help'));
  text(this.scene,'★ '+stars+' / 30    ·    不限时，慢慢解',100,H-67,520,34,20,COLORS.ink);
 }
 practice():void{this.load(0);this.startGuide()}
 settings():void{
  this.modal('玉盘小憩',['跟随自己的节奏，静静解开每一扣。'],[
   {label:this.audio.enabled?'音效 开':'音效 关',action:()=>{this.toggleSound();this.settings()},primary:false},
   {label:'新手练习',action:()=>this.practice(),primary:false},
   {label:'回到玉盘',action:()=>this.hideModal(),primary:true}
  ]);
 }
 toggleSound():void{this.audio.enabled=!this.audio.enabled;this.save.data.sound=this.audio.enabled;this.save.persist()}
 levels():void{
  this.clear('levels');
  this.scene.addChild(new Button('',30,28,76,66,()=>this.home(),false,'back'));
  text(this.scene,'玉环十境',160,41,400,70,44,COLORS.ink,'center',true);
  const count=Object.keys(this.save.data.records).filter(i=>Number(i)<TEACHING_COUNT).length;
  text(this.scene,'教学十关 · 已解 '+count+' / 10 境',80,133,560,43,23,COLORS.ink);
  ornament(this.scene,185,202,350);
  const sy=237,cell=Math.min(191,(H-320)/5);
  for(let i=0;i<10;i++){
   const x=i%2?378:42,y=sy+Math.floor(i/2)*cell,open=i<=this.save.data.unlocked,done=this.save.data.records[i],current=i===this.save.data.unlocked;
   const b=new Button('',x,y,300,cell-20,()=>this.load(i),current);b.enabled=open;this.scene.addChild(b);
   const ink=current?'#fff8d7':COLORS.ink,gold=current?'#f5dfa0':COLORS.gold;
   text(b,String(i+1).padStart(2,'0'),14,12,67,48,35,open?gold:COLORS.muted,'center',true);
   text(b,C.levels[i].name,86,14,202,48,27,open?ink:COLORS.muted,'left',true);
   text(b,done?'★'.repeat(done.stars)+'☆'.repeat(3-done.stars):open?'从这一境开始':'解开上一境',26,cell-80,247,44,23,done?gold:ink);
   if(!open)icon(b.graphics,'lock',20,cell-69,23,COLORS.muted);
  }
  this.scene.addChild(new Button('正式挑战 · 九宫锁玉阵',120,H-78,480,60,()=>this.load(FORMAL_INDEX),true,'play'));
 }
 load(i:number):void{
  if(i<0||i>=C.levels.length||(i!==FORMAL_INDEX&&i>this.save.data.unlocked))return;
  this.clear('game');this.settled=false;this.model=new GameModel(i);
  panel(this.scene,this.formal?42:105,this.formal?98:105,this.formal?636:510,this.formal?74:113,this.formal?20:26,'rgba(255,251,232,0.97)','#cdb37b');
  this.scene.addChild(new Button('图谱',28,26,136,64,()=>this.levels(),false,'map'));
  const sound=new Button(this.audio.enabled?'音效 开':'音效 关',456,26,116,60,()=>{
   this.toggleSound();sound.label.text=this.audio.enabled?'音效 开':'音效 关';
  });this.scene.addChild(sound);
  this.scene.addChild(new Button('玩法',586,26,106,64,()=>this.help(),false,'help'));
  text(this.scene,i===FORMAL_INDEX?'超级困难 · '+C.levels[i].name:'教学 '+String(i+1).padStart(2,'0')+' 境 · '+C.levels[i].name,50,this.formal?99:110,620,this.formal?38:64,this.formal?28:39,COLORS.ink,'center',true);
  this.status=text(this.scene,'',70,this.formal?137:179,580,this.formal?30:38,21,COLORS.ink);
  if(!this.formal)ornament(this.scene,176,229,368);
  if(this.formal){
   const plateH=H-370,plateY=174;
   const tray=this.image(this.scene,'assets/art-v3/tray.png',360,plateY+plateH/2,710,plateH);tray.name='board-tray';
   this.board=new Board(this.scene,{x:24,y:plateY+12,w:672,h:plateH-24});this.board.load(this.model.state,{w:710,h:plateH});
   this.board.attachBackdrop([this.garden!,tray]);
   const y=H-176;
   this.scene.addChild(new Button('−',191,y,78,62,()=>this.zoomView(1/1.35)));
   this.scene.addChild(new Button('全盘',283,y,154,62,()=>{this.releasePointers();this.board!.resetView();this.syncView()}));
   this.scene.addChild(new Button('+',451,y,78,62,()=>this.zoomView(1.35)));
   this.scene.addChild(new Button('重开',38,H-94,312,62,()=>this.load(i),false,'restart'));
   this.scene.addChild(new Button('回到首页',370,H-94,312,62,()=>this.home(),false,'back'));
   this.syncView();
  }else{
  const plateH=H-616;
  const tray=this.image(this.scene,'assets/art-v3/tray.png',360,246+plateH/2,710,plateH);tray.name='board-tray';
  this.board=new Board(this.scene,{x:73,y:288,w:574,h:H-678});this.board.load(this.model.state);
  this.board.attachBackdrop([this.garden!,tray]);
  panel(this.scene,35,H-387,650,130,24,'rgba(255,250,229,0.97)','#d4bf90');
  this.guideTitle=text(this.scene,'解镯小提示',56,H-380,606,35,20,COLORS.gold,'left');
  const tips=['拖动粉色 B 镯，把缺口转向两镯之间的空心扣。','带 × 的锁杆留在原地，两只手镯各对齐自己的扣。','先解外围 B 镯，再观察留下的完整锁杆。'];
  this.message=text(this.scene,tips[i]||C.levels[i].tip,56,H-340,606,72,23,COLORS.ink,'left');
  text(this.scene,'用手指沿玉镯拖动，直接转动缺口',54,H-229,612,48,25,COLORS.ink);
  this.scene.addChild(new Button('重开',80,H-143,260,68,()=>this.load(i),false,'restart'));
  this.scene.addChild(new Button('提示',380,H-143,260,68,()=>void this.hint(),false,'hint'));
  panel(this.scene,48,H-62,624,44,16,'rgba(255,251,232,0.92)','#d4bf90');
  text(this.scene,'拖动环体旋转 · 松手靠近扣位可轻吸附',55,H-55,610,32,18,COLORS.ink);
  }
  this.sync();
  if(i<3&&this.save.data.tutorial<=i&&!this.save.data.records[i])this.startGuide();
 }
 startGuide():void{
  if(!this.model||!this.board||this.formal)return;this.stopGuide(false);
  const first=solutions[this.model.index][0];this.guide=new Guide(this.scene,this.board,first.id);
  this.guideTitle!.text=this.model.index===0?'新手 · 1 / 2  找到粉色 B 镯':this.model.index===1?'新机关 · 背景固定扣':'新机关 · 保留的锁杆';
  this.guideTitle!.width=490;this.message!.width=514;
  this.guideSkip=new Button('跳过',582,H-371,84,62,()=>this.stopGuide(true));this.scene.addChild(this.guideSkip);
  this.guide.draw(this.model.state,performance.now(),false);
 }
 stopGuide(remember=false):void{
  if(remember&&this.model){this.save.data.tutorial=Math.max(this.save.data.tutorial,this.model.index+1);this.save.persist()}
  this.guide?.destroy();this.guide=null;this.guideSkip?.destroy();this.guideSkip=null;
  if(this.guideTitle){this.guideTitle.text='解镯小提示';this.guideTitle.width=606}
  if(this.message)this.message.width=606;
 }
 guideSelect(id:string):void{
  if(!this.guide||!this.model)return;
  if(id!==this.guide.id){this.say('先试试 '+this.guide.id+' 镯。金色角标标出了它要对齐的扣。');return}
  this.guide.phase='turn';
  if(this.model.index===0){this.guideTitle!.text='新手 · 2 / 2  拖动，让缺口对准扣';this.say('手指沿粉色 B 镯转一转，缺口对准金色角标里的空心扣。')}
 }
 say(content:string):void{if(this.message)this.message.text=content}
 sync():void{
  if(!this.model||!this.board)return;
  const s=this.model.state,n=s.rings.filter(r=>r.life==='active').length;
  this.status!.text=n+' 镯待解  ·  '+s.steps+' 次转动'+(!this.formal&&this.model.selected?'  ·  选中 '+this.model.selected:'');
  this.board.selected=this.model.selected;this.board.draw(s);
  this.controls.forEach(b=>b.enabled=!this.busy&&!this.board!.animating&&!!this.model!.selected&&!this.modalOpen);
  if(this.undoButton)this.undoButton.enabled=this.model.history.length>0&&!this.modalOpen;
  if(this.demoButton)this.demoButton.label.text=this.busy?'停止':'演示';
 }
 releaseDrag(releaseCapture=true):void{
  this.audio.stopMotion();this.audio.resetContact();
  const d=this.drag;this.drag=null;
  if(d&&releaseCapture){this.pointers.delete(d.pointer);try{if(this.canvas.hasPointerCapture(d.pointer))this.canvas.releasePointerCapture(d.pointer)}catch{}}
 }
 cancel():void{
  this.audio.stopAll();
  this.epoch++;this.busy=false;this.releasePointers();
  this.worker?.terminate();this.worker=null;
  this.finishPlan?.(null);this.finishPlan=null;
  if(this.demoButton)this.demoButton.label.text='演示';
  this.sync();
 }
 point(e:MouseEvent):Point{
  const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};
 }
 releasePointers():void{
  this.releaseDrag();const ids=[...this.pointers.keys()];this.pointers.clear();this.viewGesture=null;
  for(const id of ids)try{if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id)}catch{}
 }
 syncView():void{
  if(!this.board)return;
  if(this.viewLabel)this.viewLabel.text=Math.round(this.board.zoom/this.board.fitZoom*100)+'% · '+'双指缩放 / 移动 · 拖空白移动 · 拖玉镯旋转';
 }
 zoomView(factor:number):void{
  if(!this.board||this.modalOpen)return;this.releasePointers();const r=this.board.rect;
  this.board.zoomTo(this.board.zoom*factor,{x:r.x+r.w/2,y:r.y+r.h/2});this.syncView();
 }
 down(e:PointerEvent):void{
  this.audio.wake();
  if(this.mode!=='game'||!this.model||!this.board||this.busy||this.board.animating||this.modalOpen||(e.button!==undefined&&e.button!==0))return;
  const p=this.point(e);if(!this.board.contains(p))return;
  this.pointers.set(e.pointerId,p);this.canvas.setPointerCapture(e.pointerId);
  if(this.pointers.size>=2){
   this.releaseDrag(false);const [a,b]=[...this.pointers.values()];const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   this.viewGesture={kind:'pinch',start:mid,screen:{...this.board.screen},zoom:this.board.zoom,distance:Math.max(1,C.dist(a,b)),anchor:this.board.toWorld(mid)};return;
  }
  const ring=this.panMode?undefined:this.board.pick(p,this.model.state);
  if(!ring){this.viewGesture={kind:'pan',start:p,screen:{...this.board.screen},zoom:this.board.zoom,distance:0,anchor:p};return}
  this.model.selected=ring.id;this.board.hint=null;this.guideSelect(ring.id);
  this.drag={id:ring.id,pointer:e.pointerId,last:C.angle(ring,this.board.toWorld(p)),started:false};
  this.audio.play('select');this.sync();
 }
 move(e:PointerEvent):void{
  if(!this.pointers.has(e.pointerId)||!this.model||!this.board||this.busy||this.modalOpen)return;
  const point=this.point(e);this.pointers.set(e.pointerId,point);const gesture=this.viewGesture;
  if(gesture){
   if(gesture.kind==='pinch'&&this.pointers.size>=2){const [a,b]=[...this.pointers.values()];const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};this.board.zoomTo(gesture.zoom*C.dist(a,b)/gesture.distance,mid,gesture.anchor)}
   else if(gesture.kind==='pan')this.board.panTo({x:gesture.screen.x+point.x-gesture.start.x,y:gesture.screen.y+point.y-gesture.start.y});
   this.syncView();return;
  }
  const d=this.drag;if(!d||d.pointer!==e.pointerId||this.board.animating)return;
  const r=C.ring(this.model.state,d.id);if(!r||r.life!=='active'){this.releaseDrag();return}
  const p=this.board.toWorld(point);if(C.dist(p,r)<15)return;
  const a=C.angle(r,p),delta=C.diff(a,d.last);d.last=a;
  if(Math.abs(delta)<.08)return;
  if(!d.started){this.model.begin();d.started=true}
  this.perform(d.id,delta);
 }
 up(e:PointerEvent):void{
  const d=this.drag?.pointer===e.pointerId?this.drag:null;
  this.pointers.delete(e.pointerId);if(d)this.releaseDrag();
  try{if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId)}catch{}
  if(!this.pointers.size)this.viewGesture=null;
  if(d?.started&&!this.busy&&!this.board?.animating)this.snap(d.id);
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
  if(this.formal||!this.model||!this.model.selected||this.busy||this.board?.animating||this.modalOpen)return;
  this.guideSelect(this.model.selected);this.audio.resetContact();this.model.begin();this.board!.hint=null;this.perform(this.model.selected,delta);
 }
 perform(id:string,d:number):Result{
  const model=this.model!,before=C.clone(model.state),res=model.turn(id,d);
  if(res.done){this.audio.motion(res.done);if(!res.blocked)this.audio.resetContact()}
  if(res.removed.length){
   this.releaseDrag();this.board!.release(before,model.state,res.removed);this.audio.play('clear');
   this.say(res.removed.join('、')+' 已解开。观察下一只手镯的扣位。');
   if(this.guide&&res.removed.includes(this.guide.id))this.stopGuide(true);
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
   this.hideModal();this.settled=false;const view={zoom:this.board!.zoom,screen:{...this.board!.screen}};this.board!.load(this.model.state);this.board!.zoom=view.zoom;this.board!.panTo(view.screen);
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
  if(this.formal||this.busy||this.modalOpen||this.board?.animating||!this.model)return;
  this.busy=true;const token=++this.epoch;this.say('正在观察当前扣位…');this.sync();
  const path=await this.plan();if(token!==this.epoch)return;
  this.busy=false;
  if(!path?.length){this.say('这一步还没找到路线。可以重开，再观察连接。');this.sync();return}
  const a=path[0];this.model.selected=a.id;
  const z=this.model.state.rods.find(z=>z.id===a.rod)!;
  this.board!.hint=C.endpoints(this.model.state,z).find(e=>e.id===a.id)?.p||null;
  this.say('先转 '+a.id+'，'+(a.delta>0?'顺时针':'逆时针')+'让缺口对准闪光的空心扣。');this.sync();
  this.modal('看这一只玉环',['已标出 '+a.id+' 的目标扣位。','用手指拖动玉镯，对准标出的扣位。'],[
   {label:'我来转',action:()=>this.hideModal(),primary:true}
  ]);
 }
 async automatic(all:boolean):Promise<void>{
  if(this.formal||this.busy||this.modalOpen||this.board?.animating||!this.model)return;
  this.stopGuide(false);this.busy=true;const token=++this.epoch;this.say('正在寻找合法旋转路线…');this.sync();
  const full=await this.plan();if(token!==this.epoch)return;
  if(!full?.length){this.busy=false;this.say('当前没有找到路线。可重开。');this.sync();return}
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
  const now=performance.now();
  if(this.mode==='home'&&this.homeSpark&&now-this.lastHomeFrame>80){
   this.lastHomeFrame=now;const g=this.homeSpark.graphics;g.clear();const cy=370+(H-870)/2;
   for(let i=0;i<7;i++){const a=now/6000+i*Math.PI*2/7;const x=360+Math.cos(a)*210,y=cy+Math.sin(a)*130;g.drawCircle(x,y,1.2+Math.sin(a*3)*.5,'rgba(168,130,51,0.48)')}
  }
  if(!this.model||!this.board||this.mode!=='game')return;
  if(this.guide&&!this.modalOpen)this.guide.draw(this.model.state,now,!!this.drag);
  if(this.board.animating||this.board.sparks.length||this.board.hint||performance.now()<this.board.blockUntil)this.board.draw(this.model.state);
  this.controls.forEach(b=>b.enabled=!this.busy&&!this.board!.animating&&!!this.model!.selected&&!this.modalOpen);
  if(this.model.cleared&&!this.board.animating&&!this.busy&&!this.settled){this.settled=true;this.win()}
 }
 win():void{
  if(!this.model)return;const i=this.model.index,steps=this.model.state.steps;
  if(this.formal){const stars=this.save.win(i,steps,solutions[i].length);this.audio.play('win');this.modal('九宫锁玉阵 · 全部解开',['★'.repeat(stars)+'☆'.repeat(3-stars),'54 只玉镯全部解开 · '+steps+' 次转动','最高难度挑战已记录，可以再来寻找更巧的拆解路线。'],[{label:'回到首页',action:()=>this.home(),primary:true},{label:'再挑战一次',action:()=>this.load(i),primary:false}]);return}
  const stars=this.save.win(i,steps,solutions[i].length);if(i<3){this.save.data.tutorial=Math.max(this.save.data.tutorial,i+1);this.save.persist()}this.stopGuide(false);this.audio.play('win');
  this.modal(i===9?'十境皆通':'这一境，解开了',['★'.repeat(stars)+'☆'.repeat(3-stars),C.levels[i].name+' · '+steps+' 次转动',i===9?'玉环十境全部完成，随时回来再解。':'下一境已开启，机关会再多一点变化。'],[
   {label:i===9?'回到十境图谱':'进入第 '+(i+2)+' 境',action:()=>i===9?this.levels():this.load(i+1),primary:true},
   {label:'再解一次',action:()=>this.load(i),primary:false}
  ]);
 }
 help():void{
  this.cancel();this.guide?.clear();this.modal('记住三件小事',[
   '① 拖动环体，让细缺口对准空心扣。点击只选中，不会转动。',
   '② 实心座随所属镯转动；带 × 的背景锁杆留在原地。被卡住，先解旁边的镯。',
   '③ 对齐后要保持，转离会重新扣合。剩下的完整锁杆仍会挡住转动。'
  ],[
   {label:'继续拆解',action:()=>this.hideModal(),primary:true},
   {label:this.formal?'观察全盘':'重看这一步',action:()=>{this.hideModal();if(this.formal){this.board?.resetView();this.syncView()}else if(this.model&&this.model.index<3)this.startGuide();else void this.hint()},primary:false}
  ]);
 }
 modal(title:string,lines:string[],actions:{label:string;action:()=>void;primary:boolean}[]):void{
  this.hideModal();this.modalOpen=true;this.releasePointers();
  this.guide?.clear();const shade=new Laya.Sprite();shade.size(W,H);shade.graphics.drawRect(0,0,W,H,'rgba(47,63,41,0.36)');shade.mouseEnabled=true;
  shade.on(Laya.Event.CLICK,this,()=>{});this.overlay.addChild(shade);
  const height=Math.min(H-150,250+lines.length*85+actions.length*84),card=panel(this.overlay,50,(H-height)/2,620,height,32,'#fff9e8','#c5aa71');
  card.mouseEnabled=true;card.on(Laya.Event.CLICK,this,()=>{});
  text(card,title,30,28,560,68,37,COLORS.ink,'center',true);ornament(card,160,117,300);
  let y=139;
  for(const line of lines){text(card,line,40,y,540,78,line.startsWith('★')?52:23,line.startsWith('★')?COLORS.gold:COLORS.ink);y+=85}
  for(const a of actions){card.addChild(new Button(a.label,60,y,500,64,a.action,a.primary));y+=84}
  this.sync();
 }
 hideModal():void{
  this.overlay.destroy(true);this.overlay=new Laya.Sprite();this.overlay.zOrder=50;this.root.addChild(this.overlay);this.modalOpen=false;
  if(this.model&&this.board)this.sync();
 }
}
async function boot():Promise<void>{
 // The 2D game needs no WebGL2 features. WebGL1 keeps scene caches single-sampled
 // instead of allocating 4x MSAA targets for the magnified photographic board.
 Laya.Config.useWebGL2=false;
 await Laya.init(RENDER_W,Math.round(H*RENDER_SCALE));Laya.stage.scaleMode=Laya.Stage.SCALE_SHOWALL;Laya.stage.screenMode=Laya.Stage.SCREEN_NONE;
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


