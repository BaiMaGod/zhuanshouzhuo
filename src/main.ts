import {Core as C,GameModel} from './model.js';
import {Board} from './renderer.js';
import {text,panel,Button,ornament,COLORS,THEME,icon,flower} from './ui.js';
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
const TRAY='assets/art-rose/tray.png';
const HOME_BG='assets/art-rose/home-bg.jpg';
const ASSETS=[...JADE_ASSETS,'assets/shadow.png',TRAY,HOME_BG,'assets/art-v3/clasp.png'];
class Game {
 root=new Laya.Sprite();scene=new Laya.Sprite();overlay=new Laya.Sprite();
 garden:Laya.Sprite|null=null;wallpaper:Laya.Sprite|null=null;
 save=new Save();audio=new Audio();model:GameModel|null=null;board:Board|null=null;
 mode:'home'|'levels'|'game'='home';message:Laya.Text|null=null;status:Laya.Text|null=null;turnStatus:Laya.Text|null=null;
 controls:Button[]=[];undoButton:Button|null=null;hintButton:Button|null=null;
 pointers=new Map<number,Point>();panMode=false;viewLabel:Laya.Text|null=null;panButton:Button|null=null;
 viewGesture:{kind:'pinch'|'pan';start:Point;screen:Point;zoom:number;distance:number;anchor:Point}|null=null;
 get formal():boolean{return this.model!==null&&this.model.index>=TEACHING_COUNT}
 drag:{id:string;pointer:number;last:number;started:boolean}|null=null;canvas:HTMLCanvasElement;
 busy=false;epoch=0;worker:Worker|null=null;finishPlan:((path:Action[]|null)=>void)|null=null;
 demoButton:Button|null=null;settled=false;tutorialSeen=false;modalOpen=false;
 guide:Guide|null=null;guideTitle:Laya.Text|null=null;guideSkip:Button|null=null;homePreview:Board|null=null;modalCard:Laya.Sprite|null=null;
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
  // A quiet solid matte remains the same colour outside the moving camera.
  const bg=new Laya.Sprite();bg.name='board-garden';
  // Retain the camera registration anchor, but draw the solid matte only via
  // the stage clear: no magnified full-screen background layer or overdraw.
  Laya.stage.bgColor=THEME.paper;
  bg.mouseEnabled=false;this.scene.addChild(bg);this.garden=bg;
  if(this.mode!=='game')this.image(this.scene,HOME_BG,W/2,H/2,W,H);
 }
 clear(mode:Game['mode']):void{
  this.cancel();this.guide?.destroy();this.guide=null;this.guideTitle=null;this.guideSkip=null;this.homePreview?.destroy();this.homePreview=null;this.board?.destroy();this.board=null;this.model=null;
  // Dispose the fixed decorative wallpaper separately: it lives under the
  // gameplay scene, never inside the tray/ring rendering pass.
  this.wallpaper?.destroy(true);this.wallpaper=null;
  this.scene.destroy(true);this.scene=new Laya.Sprite();this.root.addChild(this.scene);this.scene.zOrder=0;
  this.overlay.zOrder=50;this.hideModal();this.controls=[];this.undoButton=null;this.hintButton=null;this.message=null;this.status=null;this.turnStatus=null;this.demoButton=null;this.viewLabel=null;this.panButton=null;this.panMode=false;
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
  const badge=panel(this.scene,34,30,244,58,18,THEME.white,THEME.faint);flower(badge.graphics,25,29,4,THEME.rose);
  text(badge,'教学 '+completed+' / 10',47,0,183,58,22,COLORS.ink,'center',true);
  this.scene.addChild(new Button('',608,28,76,66,()=>this.settings(),false,'settings'));
  const titleY=H<1350?122:150;
  text(this.scene,'玉  环  十  境',140,titleY-44,440,36,21,COLORS.muted,'center',true);
  text(this.scene,'转手镯消除',44,titleY,592,88,64,COLORS.ink,'center',true);
  const seal=panel(this.scene,628,titleY+13,38,66,10,THEME.rose,THEME.rose);text(seal,'玉\n环',0,3,38,60,20,THEME.white,'center',true);
  text(this.scene,'转一转，环环相扣',110,titleY+89,500,45,25,COLORS.ink,'center',true);
  const top=titleY+146,bottom=H-469,cy=(top+bottom)/2,plateH=Math.min(670,bottom-top);
  this.image(this.scene,TRAY,360,cy,636,plateH);
  this.homePreview=new Board(this.scene,{x:118,y:cy-126,w:484,h:252});this.homePreview.showLabels=false;
  const state=C.make(0);this.homePreview.load(state);this.homePreview.draw(state);
  text(this.scene,'一扣入门 · 十境解谜',140,cy+plateH/2-105,440,35,21,COLORS.muted,'center',true);
  ornament(this.scene,164,H-447,392);
  text(this.scene,'正式关卡 · 54 镯 · 超级困难',120,H-432,480,38,23,COLORS.ink,'center',true);
  this.scene.addChild(new Button('第1关',112,H-375,496,88,()=>this.load(FORMAL_INDEX),true,'play'));
  this.scene.addChild(new Button('关卡图谱',116,H-251,234,68,()=>this.levels(),false,'map'));
  this.scene.addChild(new Button('新手练习',370,H-251,234,68,()=>this.practice(),false,'help'));
  text(this.scene,'★ '+stars+' / 30    ·    不限时，慢慢解',100,H-60,520,34,20,COLORS.muted,'center',true);
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
 levels(page=0):void{
  this.clear('levels');
  const total=Math.max(0,C.levels.length-TEACHING_COUNT),pageSize=8;
  const pages=Math.max(1,Math.ceil(total/pageSize)),current=Math.max(0,Math.min(pages-1,page));
  const passed=Object.keys(this.save.data.records).filter(k=>Number(k)>=TEACHING_COUNT&&Number(k)<C.levels.length).length;
  this.scene.addChild(new Button('',30,28,76,66,()=>this.home(),false,'back'));
  text(this.scene,'关卡图谱',160,41,400,70,44,COLORS.ink,'center',true);
  text(this.scene,'正式关卡 · 已通关 '+passed+' / '+total+' 关',80,133,560,43,23,COLORS.ink,'center');
  ornament(this.scene,185,202,350);
  const start=current*pageSize,end=Math.min(total,start+pageSize),single=total===1;
  const cellH=Math.min(190,(H-410)/4);
  for(let j=start;j<end;j++){
   const index=TEACHING_COUNT+j,slot=j-start;
   const x=single?68:slot%2?378:42;
   const y=single?Math.max(285,Math.round((H-245)/2)-90):247+Math.floor(slot/2)*(cellH+12);
   const w=single?584:300,h=single?228:cellH;
   const done=this.save.data.records[index];
   const b=new Button('',x,y,w,h,()=>this.load(index),j===0);
   b.name='formal-level:'+String(j+1);this.scene.addChild(b);
   const ink=j===0?THEME.white:COLORS.ink;
   const secondary=j===0?THEME.white:COLORS.muted;
   text(b,'第'+(j+1)+'关',26,single?24:13,w-52,56,single?48:36,ink,'left',true);
   text(b,C.levels[index].points.length+' 镯 · 正式挑战',28,single?97:70,w-56,42,single?27:23,secondary);
   text(b,done?'已通关  '+'★'.repeat(done.stars)+'☆'.repeat(3-done.stars):'点击挑战',28,single?165:123,w-56,36,23,secondary);
  }
  if(total===0)text(this.scene,'正式关卡正在制作中',100,Math.round(H/2)-30,520,66,28,COLORS.muted,'center');
  if(pages>1){
   if(current>0)this.scene.addChild(new Button('上一页',90,H-162,236,66,()=>this.levels(current-1),false,'back'));
   if(current<pages-1)this.scene.addChild(new Button('下一页',394,H-162,236,66,()=>this.levels(current+1),false,'play'));
   text(this.scene,(current+1)+' / '+pages,310,H-151,100,40,22,COLORS.muted,'center');
  }
  text(this.scene,'拖动玉镯，逐关解开相扣的机关',86,H-77,548,43,22,COLORS.muted,'center');
 }
 load(i:number):void{
  if(i<0||i>=C.levels.length||(i<TEACHING_COUNT&&i>this.save.data.unlocked))return;
  this.clear('game');this.settled=false;this.model=new GameModel(i);
  if(this.formal){
   // The wallpaper must be behind the *entire cached gameplay scene*, not
   // another child of it: otherwise Laya's bitmap cache can flatten it
   // against the tray and obscure the original artwork.
   const wallpaper=this.image(this.root,HOME_BG,W/2,H/2,W,H);
   wallpaper.name='formal-wallpaper';wallpaper.zOrder=-10;
   this.wallpaper=wallpaper;
   const home=new Button('',28,26,76,64,()=>this.home(),false,'home');home.name='button:home';this.scene.addChild(home);
   const restart=new Button('',116,26,76,64,()=>this.load(i),false,'restart');restart.name='button:restart';this.scene.addChild(restart);
   const title=text(this.scene,'第'+(i-TEACHING_COUNT+1)+'关',216,26,288,64,43,COLORS.ink,'center',true);
   const sound=new Button('',528,26,76,64,()=>{this.toggleSound();sound.setIcon(this.audio.enabled?'sound':'mute')},false,this.audio.enabled?'sound':'mute');sound.name='button:sound';this.scene.addChild(sound);
   const help=new Button('',616,26,76,64,()=>this.help(),false,'help');help.name='button:help';this.scene.addChild(help);
   this.status=text(this.scene,'',28,101,290,34,23,COLORS.ink,'left');
   this.turnStatus=text(this.scene,'',402,101,290,34,23,COLORS.ink,'right');
  }else{
  panel(this.scene,105,105,510,113,22,THEME.white,THEME.faint);
  const practiceHome=new Button('',28,26,76,64,()=>this.home(),false,'home');practiceHome.name='button:home';this.scene.addChild(practiceHome);
  this.scene.addChild(new Button('图谱',116,26,112,64,()=>this.levels(),false,'map'));
  const sound=new Button(this.audio.enabled?'音效 开':'音效 关',456,26,116,60,()=>{
   this.toggleSound();sound.label.text=this.audio.enabled?'音效 开':'音效 关';
  });this.scene.addChild(sound);
  this.scene.addChild(new Button('玩法',586,26,106,64,()=>this.help(),false,'help'));
  text(this.scene,'教学 '+String(i+1).padStart(2,'0')+' 境 · '+C.levels[i].name,50,110,620,64,39,COLORS.ink,'center',true);
  this.status=text(this.scene,'',70,179,580,38,21,COLORS.ink);
  ornament(this.scene,176,229,368);
  }
  if(this.formal){
   const plateH=H-244,plateY=142;
   const tray=this.image(this.scene,TRAY,360,plateY+plateH/2,710,plateH);tray.name='board-tray';
   this.board=new Board(this.scene,{x:24,y:plateY+12,w:672,h:plateH-24});this.board.load(this.model.state,{w:710,h:plateH});
   this.board.attachBackdrop([this.garden!,tray]);
   const y=H-84;
   this.hintButton=new Button('提示',28,y,146,62,()=>void this.hint(),false,'hint');this.scene.addChild(this.hintButton);
   this.scene.addChild(new Button('−',208,y,76,62,()=>this.zoomView(1/1.35)));
   this.scene.addChild(new Button('全盘',298,y,124,62,()=>{this.releasePointers();this.board!.resetView();this.syncView()}));
   this.scene.addChild(new Button('+',436,y,76,62,()=>this.zoomView(1.35)));
   this.syncView();
  }else{
  const plateH=H-616;
  const tray=this.image(this.scene,TRAY,360,246+plateH/2,710,plateH);tray.name='board-tray';
  this.board=new Board(this.scene,{x:73,y:288,w:574,h:H-678});this.board.load(this.model.state);
  this.board.attachBackdrop([this.garden!,tray]);
  panel(this.scene,35,H-387,650,130,22,THEME.white,THEME.faint);
  this.guideTitle=text(this.scene,'解镯小提示',56,H-380,606,35,20,COLORS.gold,'left');
  const tips=['拖动粉色 B 镯，把缺口转向两镯之间的空心扣。','带 × 的锁杆留在原地，两只手镯各对齐自己的扣。','先解外围 B 镯，再观察留下的完整锁杆。'];
  this.message=text(this.scene,tips[i]||C.levels[i].tip,56,H-340,606,72,23,COLORS.ink,'left');
  text(this.scene,'用手指沿玉镯拖动，直接转动缺口',54,H-229,612,48,25,COLORS.ink);
  this.scene.addChild(new Button('重开',80,H-143,260,68,()=>this.load(i),false,'restart'));
  this.scene.addChild(new Button('提示',380,H-143,260,68,()=>void this.hint(),false,'hint'));
  panel(this.scene,48,H-62,624,44,16,THEME.white,THEME.faint);
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
  if(this.formal){this.stopGuide(false);return}
  if(id!==this.guide.id){this.say('先试试 '+this.guide.id+' 镯。藕粉色角标标出了它要对齐的扣。');return}
  this.guide.phase='turn';
  if(this.model.index===0){this.guideTitle!.text='新手 · 2 / 2  拖动，让缺口对准扣';this.say('手指沿粉色 B 镯转一转，缺口对准藕粉色角标里的空心扣。')}
 }
 say(content:string):void{if(this.message)this.message.text=content}
 sync():void{
  if(!this.model||!this.board)return;
  const s=this.model.state,n=s.rings.filter(r=>r.life==='active').length;
  this.status!.text=this.formal?n+' 手镯待解':n+' 镯待解  ·  '+s.steps+' 次转动'+(this.model.selected?'  ·  选中 '+this.model.selected:'');
  if(this.turnStatus)this.turnStatus.text=s.steps+' 次转动';
  this.board.selected=this.model.selected;this.board.draw(s);
  this.controls.forEach(b=>b.enabled=!this.busy&&!this.board!.animating&&!!this.model!.selected&&!this.modalOpen);
  if(this.undoButton)this.undoButton.enabled=this.model.history.length>0&&!this.modalOpen;
  if(this.demoButton)this.demoButton.label.text=this.busy?'停止':'演示';
  if(this.hintButton)this.hintButton.enabled=!this.busy&&!this.board.animating&&!this.modalOpen;
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
  if(this.busy||this.modalOpen||this.board?.animating||!this.model)return;
  this.busy=true;const token=++this.epoch;this.say('正在观察当前扣位…');if(this.hintButton)this.hintButton.label.text='观察…';this.sync();
  const path=await this.plan();if(token!==this.epoch)return;
  this.busy=false;if(this.hintButton)this.hintButton.label.text='提示';
  if(!path?.length){this.say('这一步还没找到路线。可以重开，再观察连接。');if(this.hintButton)this.hintButton.label.text='暂无路线';this.sync();return}
  const a=path[0];this.model.selected=a.id;
  if(this.formal){
   this.releasePointers();this.stopGuide(false);
   const ring=C.ring(this.model.state,a.id)!;
   const p=this.board!.toScreen(ring),radius=(C.R+C.BAND/2+22)*this.board!.zoom,b=this.board!.rect;
   if(p.x-radius<b.x||p.x+radius>b.x+b.w||p.y-radius<b.y||p.y+radius>b.y+b.h){
    const offset=C.rot({x:ring.x-this.board!.center.x,y:ring.y-this.board!.center.y},this.board!.turn);
    this.board!.panTo({x:b.x+b.w/2-offset.x*this.board!.zoom,y:b.y+b.h/2-offset.y*this.board!.zoom});
   }
   this.guide=new Guide(this.scene,this.board!,a.id,a);this.guide.phase='turn';
   this.guide.draw(this.model.state,performance.now(),false);this.sync();return;
  }
  const z=this.model.state.rods.find(z=>z.id===a.rod);
  this.board!.hint=z?C.endpoints(this.model.state,z).find(e=>e.id===a.id)?.p||null:null;
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
  if(!this.model||!this.board||this.mode!=='game')return;
  if(this.guide&&!this.modalOpen)this.guide.draw(this.model.state,now,!!this.drag);
  if(this.board.animating||this.board.sparks.length||this.board.hint||performance.now()<this.board.blockUntil)this.board.draw(this.model.state);
  this.controls.forEach(b=>b.enabled=!this.busy&&!this.board!.animating&&!!this.model!.selected&&!this.modalOpen);
  if(this.hintButton)this.hintButton.enabled=!this.busy&&!this.board.animating&&!this.modalOpen;
  if(this.model.cleared&&!this.board.animating&&!this.busy&&!this.settled){this.settled=true;this.win()}
 }
 win():void{
  if(!this.model)return;const i=this.model.index,steps=this.model.state.steps;
  if(this.formal){const stars=this.save.win(i,steps,solutions[i].length),level='第'+(i-TEACHING_COUNT+1)+'关';this.audio.play('win');this.modal(level+' · 全部解开',['★'.repeat(stars)+'☆'.repeat(3-stars),C.levels[i].points.length+' 只玉镯全部解开 · '+steps+' 次转动','通关成绩已记录，可以再试试更巧的拆解路线。'],[{label:'回到首页',action:()=>this.home(),primary:true},{label:'再挑战一次',action:()=>this.load(i),primary:false}]);return}
  const stars=this.save.win(i,steps,solutions[i].length);if(i<3){this.save.data.tutorial=Math.max(this.save.data.tutorial,i+1);this.save.persist()}this.stopGuide(false);this.audio.play('win');
  this.modal(i===9?'十境皆通':'这一境，解开了',['★'.repeat(stars)+'☆'.repeat(3-stars),C.levels[i].name+' · '+steps+' 次转动',i===9?'玉环十境全部完成，随时回来再解。':'下一境已开启，机关会再多一点变化。'],[
   {label:i===9?'进入正式关卡':'进入第 '+(i+2)+' 境',action:()=>i===9?this.levels():this.load(i+1),primary:true},
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
  this.guide?.clear();const shade=new Laya.Sprite();shade.size(W,H);shade.graphics.drawRect(0,0,W,H,'rgba(81,57,69,0.28)');shade.mouseEnabled=true;
  shade.on(Laya.Event.CLICK,this,()=>{});this.overlay.addChild(shade);
  const height=Math.min(H-150,250+lines.length*85+actions.length*84),card=panel(this.overlay,50,(H-height)/2,620,height,28,THEME.white,THEME.line);
  this.modalCard=card;
  if(Laya.Tween&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){card.alpha=0;Laya.Tween.to(card,{alpha:1},140,Laya.Ease.sineOut)}
  card.mouseEnabled=true;card.on(Laya.Event.CLICK,this,()=>{});
  text(card,title,30,28,560,68,37,COLORS.ink,'center',true);ornament(card,160,117,300);
  let y=139;
  for(const line of lines){text(card,line,40,y,540,78,line.startsWith('★')?52:23,line.startsWith('★')?COLORS.gold:COLORS.ink);y+=85}
  for(const a of actions){card.addChild(new Button(a.label,60,y,500,64,a.action,a.primary));y+=84}
  this.sync();
 }
 hideModal():void{
  if(this.modalCard){Laya.Tween?.clearAll(this.modalCard);this.modalCard=null}
  this.overlay.destroy(true);this.overlay=new Laya.Sprite();this.overlay.zOrder=50;this.root.addChild(this.overlay);this.modalOpen=false;
  if(this.model&&this.board)this.sync();
 }
}
async function boot():Promise<void>{
 // Load the compact Chinese fonts before Laya measures or caches any UI text.
 if(document.fonts)await Promise.all([document.fonts.load('24px JadeSong'),document.fonts.load('24px JadeText')]);
 // The 2D game needs no WebGL2 features. WebGL1 keeps scene caches single-sampled
 // instead of allocating 4x MSAA targets for the magnified photographic board.
 Laya.Config.useWebGL2=false;
 await Laya.init(RENDER_W,Math.round(H*RENDER_SCALE));Laya.stage.scaleMode=Laya.Stage.SCALE_SHOWALL;Laya.stage.screenMode=Laya.Stage.SCREEN_NONE;
 Laya.stage.alignH='center';Laya.stage.alignV='middle';Laya.stage.bgColor=THEME.paper;
 await Laya.loader.load(ASSETS);const g=new Game();await g.audio.load();document.getElementById('boot')?.remove();
 if(new URLSearchParams(location.search).has('debug')){
  (window as unknown as {jadeDebug:unknown}).jadeDebug={game:g,Core:C,getState:()=>g.model?C.clone(g.model.state):null};
 }
}
boot().catch(e=>{
 console.error(e);const box=document.getElementById('boot');
 if(box){box.classList.add('error');box.textContent='玉盘暂时没有加载完成，请刷新再试。'}
});


