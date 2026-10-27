import {Core as C,GameModel} from './model.js';
import {Board} from './renderer.js';
import {text,panel,Button,ornament,COLORS,THEME,icon,flower,round} from './ui.js';
import {Guide,HINT_HAND_ASSET} from './guide.js';
import {GestureHand} from './gesture-hand.js';
import {Audio} from './audio.js';
import {Haptics} from './haptics.js';
import {snapDelta} from './snap.js';
import {Save} from './storage.js';
import type {RewardKind,RewardSource} from './storage.js';
import {DAILY_REWARDS} from './signin-inventory.js';
import {FEATURE_ART,FEATURE_ASSETS,paintFeature} from './feature-art.js';
import {TapPlatform} from './taptap.js';
import {copyPlatformText,finishWebShell,failWebShell,debugEnabled,debugHintEnabled,exposeDebug,setGameCursorHidden} from './web-shell.js';
import {search,nextFrame} from './solver.js';
interface GamePointer {pointerId:number;stageX:number;stageY:number;button?:number}
import {JADE_ASSETS,jadeSprite} from './jade.js';
import solutions from './solutions.js';
import {TEACHING_COUNT,FORMAL_INDEX} from './levels.js';
import type {Action,Point,State,Result} from './types.js';

const BOOT_STARTED=performance.now();
const W=720;
let H=1280,RENDER_W=720,RENDER_SCALE=1;
const TRAY='assets/art-rose/tray.png';
const HOME_BG='assets/art-rose/home-bg.jpg';
// Build pipeline injects package.json's current version for every target.
const GAME_VERSION='__GAME_VERSION__';
const ASSETS=[HINT_HAND_ASSET,...JADE_ASSETS,...FEATURE_ASSETS,'assets/shadow.png',TRAY,HOME_BG,'assets/art-v3/clasp.png'];
class Game {
 readonly debugMode=debugHintEnabled();
 root=new Laya.Sprite();scene=new Laya.Sprite();overlay=new Laya.Sprite();
 cursorHand:GestureHand;activeHandPointer:number|null=null;
 garden:Laya.Sprite|null=null;wallpaper:Laya.Sprite|null=null;
 save=new Save();platform=new TapPlatform(this.save,debugEnabled());accountStatus:Laya.Text|null=null;audio=new Audio();haptics=new Haptics();model:GameModel|null=null;board:Board|null=null;
 mode:'home'|'levels'|'game'='home';message:Laya.Text|null=null;status:Laya.Text|null=null
 controls:Button[]=[];undoButton:Button|null=null;hintButton:Button|null=null;eraseButton:Button|null=null;eraseTip:Laya.Text|null=null;toolNoticeBox:Laya.Sprite|null=null;eraseMode=false;eraseTap:{id:string;pointer:number;start:Point}|null=null;
 pointers=new Map<number,Point>();panMode=false;viewLabel:Laya.Text|null=null;panButton:Button|null=null;
 viewGesture:{kind:'pinch'|'pan';start:Point;screen:Point;zoom:number;distance:number;anchor:Point}|null=null;
 atlas:Laya.Sprite|null=null;atlasOffset=0;atlasHeight=0;atlasPage=-1;atlasDrag:{id:number;y:number;offset:number;moved:boolean}|null=null;atlasClickAfter=0;
 hintLeft=1;eraseLeft=0;noticeUntil=0;nextCloudCheck=0;
 homeSignDot:Laya.Sprite|null=null;nextSignBadgeCheck=0;
 private platformViewPending=false;
 toolLeft(kind:RewardKind):number{
  return (kind==='hint'?this.hintLeft:this.eraseLeft)+this.save.inventoryLeft(kind)+(this.model?this.save.rewardLeft(this.model.index,kind):0);
 }
 consumeTool(kind:RewardKind):void{
  if(kind==='hint'&&this.hintLeft>0)this.hintLeft--;
  else if(kind==='erase'&&this.eraseLeft>0)this.eraseLeft--;
  else if(this.model){
   if(!this.save.consumeInventory(kind,this.model.index))this.save.consumeReward(this.model.index,kind);
  }
 }
 private connectionView=0;
 private platformLive:{card:Laya.Sprite;labels:Laya.Text[];read:()=>string[]}|null=null;
 private nextPlatformRefresh=0;
 async loginTap(autoTutorial=false):Promise<void>{
  if(this.mode!=='home')return;
  const view=++this.connectionView;
  const task=autoTutorial?this.platform.start():this.platform.login(true);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const complete=await Promise.race([task.then(()=>true),new Promise<false>(resolve=>{timer=setTimeout(()=>resolve(false),8000)})]);
  if(timer)clearTimeout(timer);
  if(view!==this.connectionView||this.mode!=='home'||this.modalOpen)return;
  const finish=()=>{this.audio.enabled=this.save.data.sound;this.home();if(this.platform.pendingCloud)this.showCloudConflict(autoTutorial);else if(autoTutorial)this.beginFirstVisit()};
  if(complete){finish();return}
  this.modal('正在恢复进度',['平台连接仍在进行，可以继续本地游戏。','云档恢复前，本机进度不会覆盖云端。'],[
   {label:'继续本地游戏',action:()=>{this.connectionView++;this.hideModal();finish()},primary:true},
   {label:'平台检查',action:()=>this.showPlatformCheck(),primary:false}
  ]);
  const waiting=this.modalCard;
  // A late result may dismiss only its own waiting card, never a new dialog/run.
  void task.then(()=>{if(view===this.connectionView&&this.mode==='home'&&this.modalCard===waiting){this.hideModal();finish()}});
 }
 private showPlatformCheck():void{
  const read=()=>[...this.platform.connectionLines(),...(this.platform.debug?['排行 '+this.platform.states.leaderboard+' · 广告 '+this.platform.states.ads+' · 埋点 '+this.platform.states.report]:[])];
  this.modal('平台检查',read(),[
   {label:'复制诊断',action:()=>{void copyPlatformText(this.platform.exportDiagnostics(GAME_VERSION)).then(ok=>{
    if(!ok&&this.modalCard===this.platformLive?.card&&this.platformLive.labels[3])this.platformLive.labels[3].text='复制不可用，请从自测反馈上传日志。';
   })},primary:true},
   {label:this.platform.connecting?'查看连接进度':'重试连接',action:()=>{void this.platform.login(true)},primary:false},
   {label:'返回',action:()=>this.tapMenu(),primary:false}
  ]);
  const card=this.modalCard!,labels:Laya.Text[]=[];
  for(let i=0;i<card.numChildren;i++){const child=card.getChildAt(i);if(child instanceof Laya.Text)labels.push(child)}
  this.platformLive={card,labels:labels.slice(1),read};
 }
 private showCloudConflict(autoTutorial=false):void{
  this.modal('选择局内存档',['本地和云端的盘面不同，请选择继续哪份。','通关成绩会合并，已领取广告不会重置。'],[
   {label:'继续本地盘面',action:()=>{this.platform.resolveConflict(false);this.home();if(autoTutorial)this.beginFirstVisit()},primary:false},
   {label:'继续云端盘面',action:()=>{this.platform.resolveConflict(true);this.home();if(autoTutorial)this.beginFirstVisit()},primary:true}
  ]);
 }
 tapMenu():void{
  this.modal('排行榜',['比一比通关数与收集的星数。'],[
   {label:'关卡榜',action:()=>void this.showRank(false),primary:true},
   {label:'星数榜',action:()=>void this.showRank(true),primary:false},
   {label:'关闭',action:()=>this.hideModal(),primary:false}
  ]);
 }
 async showRank(stars:boolean):Promise<void>{
  if(!await this.platform.openBoard(stars))this.modal('排行榜暂不可用',[this.platform.errorMessage('leaderboard')],[{label:'返回',action:()=>this.tapMenu(),primary:true}])
 }
 offerReward(kind:RewardKind):void{
  if(!this.model)return;
  const index=this.model.index,name=kind==='hint'?'提示':'消除';
  if(!this.platform.available){this.toolNotice('本关'+name+'已用完');return}
  const video=this.save.canClaim(index,kind),share=this.save.canClaim(index,kind,'share');
  if(!video&&!share){this.toolNotice('本关'+name+'奖励已全部领取');return}
  this.modal('获取1次'+name,['完整观看视频或成功分享，可获得1次'+name+'。','两种方式每关各限1次，重开后重置。'],[
   {label:video?'看视频得'+name:'视频奖励已领取',action:()=>{if(!video)return;this.hideModal();void this.watchReward(index,kind)},primary:true},
   {label:share?'分享得'+name:'分享奖励已领取',action:()=>{if(!share)return;this.hideModal();void this.watchReward(index,kind,'share')},primary:false},
   {label:'取消',action:()=>this.hideModal(),primary:false}
  ]);
  for(let i=0;i<this.modalCard!.numChildren;i++){
   const child=this.modalCard!.getChildAt(i);
   if(child instanceof Button&&(child.label.text==='视频奖励已领取'||child.label.text==='分享奖励已领取'))child.enabled=false;
  }
 }
 async watchReward(index:number,kind:RewardKind,source:RewardSource='video'):Promise<void>{
  if(this.busy||this.platform.rewardBusy||!this.model||this.model.index!==index||!this.save.canClaim(index,kind,source))return;
  if(source==='share'&&!this.platform.shareAvailable){this.toolNotice('分享暂不可用，请稍后再试');return}
  const model=this.model;this.releasePointers();this.stopGuide(false);this.audio.stopAll();this.busy=true;
  try{
   const completed=source==='share'?await this.platform.shareReward(JSON.stringify({level:index-TEACHING_COUNT+1,tool:kind})):await this.platform.rewarded();
   // A late callback from an old board must not affect a restarted/new run.
   if(this.model!==model)return;
   if(completed&&this.save.claim(index,kind,source)){
    this.persistRun();this.toolNotice('已获得1次'+(kind==='hint'?'提示':'消除'));void this.platform.sync();
   }else if(completed===false)this.toolNotice(source==='share'?'未完成分享，未领取奖励':'未完整观看，未领取奖励');
   else if(completed===null)this.toolNotice(source==='share'?'分享暂不可用，请稍后再试':this.platform.errorMessage('ads'));
  }catch{if(this.model===model)this.toolNotice(source==='share'?'分享暂不可用，请稍后再试':this.platform.errorMessage('ads'))}
  finally{if(this.model===model){this.busy=false;this.syncTools()}}
 }

 persistRun():void{if(this.formal&&this.model)this.save.writeRun(this.model.index,this.model.state,this.hintLeft,this.eraseLeft,this.model.hints?.progress||0)}
 toolNotice(message:string):void{
  if(this.eraseTip&&this.toolNoticeBox){this.eraseTip.text=message;this.toolNoticeBox.visible=true;this.noticeUntil=performance.now()+3200}
 }
 syncTools():void{
  if(!this.formal)return;
  if(this.hintButton){this.hintButton.label.text='提示 ×'+this.toolLeft('hint');this.hintButton.setIcon('hint')}
  if(this.eraseButton){this.eraseButton.label.text=this.eraseMode?'取消':'消除 ×'+this.toolLeft('erase');this.eraseButton.setIcon('erase')}
 }
 get formal():boolean{return this.model!==null&&this.model.index>=TEACHING_COUNT}
 drag:{id:string;pointer:number;last:number;started:boolean;blocked:boolean}|null=null;
 busy=false;epoch=0;finishPlan:((path:Action[]|null)=>void)|null=null;
 demoButton:Button|null=null;settled=false;tutorialSeen=false;modalOpen=false;
 guide:Guide|null=null;guideTitle:Laya.Text|null=null;guideSkip:Button|null=null;homePreview:Board|null=null;homeSettingsButton:Button|null=null;modalCard:Laya.Sprite|null=null;modalShade:Laya.Sprite|null=null;
 constructor(){
  this.root.scale(RENDER_SCALE,RENDER_SCALE);
  Laya.stage.addChild(this.root);this.root.addChild(this.scene);this.root.addChild(this.overlay);
  this.cursorHand=new GestureHand(this.root);
  this.audio.enabled=this.save.data.sound;Button.feedback=()=>{this.audio.wake();this.audio.play('button')};
  const pointer=(e:Laya.Event):GamePointer=>({pointerId:e.touchId,stageX:e.stageX,stageY:e.stageY,button:e.button});
  Laya.InputManager.multiTouchEnabled=true;
  Laya.stage.on(Laya.Event.MOUSE_DOWN,this,(e:Laya.Event)=>{const p=pointer(e);this.audio.wake();this.atlasDown(p);this.down(p)});
  Laya.stage.on(Laya.Event.MOUSE_MOVE,this,(e:Laya.Event)=>{const p=pointer(e);this.atlasMove(p);this.move(p)});
  Laya.stage.on(Laya.Event.MOUSE_UP,this,(e:Laya.Event)=>{
   // Laya normalizes touchcancel to MOUSE_UP. A cancelled touch must never use a tool.
   if(e.nativeEvent?.type==='touchcancel'){this.atlasDrag=null;this.releasePointers();return}
   const p=pointer(e);this.atlasUp(p);this.up(p);
  });
  Laya.stage.on(Laya.Event.MOUSE_OUT,this,(e:Laya.Event)=>{
   if(!Laya.Browser.onMobile&&this.activeHandPointer===null){
    const p=this.point(pointer(e));
    if(p.x<0||p.x>W||p.y<0||p.y>H)this.cursorHand.hide();
   }
  });
  Laya.stage.on(Laya.Event.MOUSE_WHEEL,this,(e:Laya.Event)=>{
   const delta=e.delta*40; // LayaAir 3.4 normalizes WheelEvent.deltaY by 0.025; keep native scroll direction.
   if(this.atlas&&this.mode==='levels'){this.scrollAtlas(this.atlasOffset+delta);return}
   if(this.mode!=='game'||!this.board||this.modalOpen||this.busy)return;
   const p=this.point(pointer(e));if(!this.board.contains(p))return;
   this.releasePointers();this.board.zoomTo(this.board.zoom*Math.exp(-delta*.0015),p);this.syncView();
  });
  const suspend=()=>{this.atlasDrag=null;this.cancel();this.persistRun();this.audio.suspend()};
  Laya.stage.on(Laya.Event.BLUR,this,suspend);
  Laya.stage.on(Laya.Event.FOCUS,this,()=>{this.audio.resume();void this.platform.resume()});
  Laya.stage.on(Laya.Event.VISIBILITY_CHANGE,this,()=>{if(!Laya.stage.isVisibility)suspend();else {this.audio.resume();void this.platform.resume()}});
  Laya.stage.on(Laya.Event.RESIZE,this,()=>{this.atlasDrag=null;this.releasePointers()});
  Laya.stage.on(Laya.Event.KEY_DOWN,this,(e:Laya.Event)=>{
   if(this.mode==='game'&&!this.modalOpen&&e.keyCode===27){this.eraseMode=false;this.syncEraseUI();this.cancel();this.hideModal()}
  });
  this.platform.canRestore=()=>this.mode==='home'&&!this.platform.rewardBusy;
  this.save.onChange=()=>this.platform.localChanged();
  this.platform.onChange=()=>{this.platformViewPending=true;if(this.accountStatus)this.accountStatus.text=this.platform.status};
  Laya.timer.frameLoop(1,this,this.tick);this.home();
  // Restore in the background; applying an archive is deferred while playing.
  void this.loginTap(true);
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
  this.accountStatus=null;this.atlas=null;this.atlasDrag=null;this.atlasPage=-1;
  this.cancel();this.guide?.destroy();this.guide=null;this.guideTitle=null;this.guideSkip=null;this.homePreview?.destroy();this.homePreview=null;this.board?.destroy();this.board=null;this.model=null;
  // Dispose the fixed decorative wallpaper separately: it lives under the
  // gameplay scene, never inside the tray/ring rendering pass.
  this.wallpaper?.destroy(true);this.wallpaper=null;
  this.scene.destroy(true);this.homeSettingsButton=null;this.homeSignDot=null;this.nextSignBadgeCheck=0;this.scene=new Laya.Sprite();this.root.addChild(this.scene);this.scene.zOrder=0;
  this.overlay.zOrder=50;this.hideModal();this.controls=[];this.undoButton=null;this.hintButton=null;this.eraseButton=null;this.eraseTip=null;this.toolNoticeBox?.destroy(true);this.toolNoticeBox=null;this.noticeUntil=0;this.eraseMode=false;this.eraseTap=null;this.message=null;this.status=null;this.demoButton=null;this.viewLabel=null;this.panButton=null;this.panMode=false;
  // Keep render-pass topology stable through zoom, undo and restart.
  // A full-scene bitmap cache can lose buttons when their state or icons update.
  // Preserve live HUD and cache only static decorations where appropriate.
  this.scene.size(W,H);this.scene.cacheAs='none';
  // The camera also moves the artwork. Clip its expanded bounds to the screen.
  if(mode==='game')this.scene.scrollRect=new Laya.Rectangle(0,0,W,H);
  this.mode=mode;this.setSystemCursor();this.background();
 }
 image(parent:Laya.Sprite,url:string,x:number,y:number,w:number,h:number,rotation=0):Laya.Sprite{
  const s=new Laya.Sprite();s.pos(x,y);s.graphics.drawImage(Laya.loader.getRes(url),-w/2,-h/2,w,h);s.rotation=rotation;s.mouseEnabled=false;parent.addChild(s);return s;
 }
 home():void{
  this.clear('home');
  const completed=Object.keys(this.save.data.records).filter(i=>Number(i)<TEACHING_COUNT).length;
  const badge=panel(this.scene,34,30,244,58,18,THEME.white,THEME.faint);flower(badge.graphics,25,29,4,THEME.rose);
  text(badge,'教学 '+completed+' / 10',47,0,183,58,22,COLORS.ink,'center',true);
  const settingsButton=new Button('',608,28,76,66,()=>this.settings(),false,'settings');
  settingsButton.name='button:settings';this.scene.addChild(settingsButton);this.homeSettingsButton=settingsButton;
  const titleY=H<1350?132:160;
  text(this.scene,'转手镯消除',44,titleY,592,88,64,COLORS.ink,'center',true);
  const top=titleY+112,bottom=H-438,cy=(top+bottom)/2,plateH=Math.min(670,bottom-top);
  this.image(this.scene,TRAY,360,cy,636,plateH);
  this.homePreview=new Board(this.scene,{x:118,y:cy-126,w:484,h:252});this.homePreview.showLabels=false;
  const state=C.make(0);this.homePreview.load(state);this.homePreview.draw(state);
  const current=this.formalCurrent();
  // Screen-edge shortcuts, deliberately ABOVE the main play button.
  const sign=new Button('',12,H-542,116,134,()=>this.openSignIn());
  sign.name='button:signin';this.scene.addChild(sign);
  sign.skin.graphics.clear();paintFeature(sign.skin.graphics,FEATURE_ART.signin,116,134);
  text(sign,'签到',0,101,116,31,24,COLORS.ink,'center',true);
  const bag=new Button('',W-128,H-542,116,134,()=>this.openBag());
  bag.name='button:bag';this.scene.addChild(bag);
  bag.skin.graphics.clear();paintFeature(bag.skin.graphics,FEATURE_ART.bag,116,134);
  text(bag,'背包',0,101,116,31,24,COLORS.ink,'center',true);
  const dot=new Laya.Sprite();dot.name='signin-red-dot';
  dot.pos(114,H-531);dot.graphics.drawCircle(0,0,7,THEME.rose,THEME.white,2);
  dot.mouseEnabled=false;
  const signState=this.save.dailySignInStatus();dot.visible=!signState.claimedToday&&!signState.clockInvalid;
  this.scene.addChild(dot);this.homeSignDot=dot;
  this.scene.addChild(new Button('第'+(current-TEACHING_COUNT+1)+'关',112,H-375,496,88,()=>this.load(current),true,'play'));
  this.scene.addChild(new Button('关卡图谱',116,H-251,234,68,()=>this.levels(),false,'map'));
  this.scene.addChild(new Button('新手练习',370,H-251,234,68,()=>this.practice(),false,'help'));
  if(this.platform.available){
   const rank=new Button('排行榜',244,H-164,232,56,()=>this.tapMenu(),false,'star');rank.name='button:leaderboard';this.scene.addChild(rank);
  }
  // Small, centered attribution below the home actions; avoid overlap on short screens.
  text(this.scene,'v'+GAME_VERSION+' @雨过天青',70,this.platform.available?H-65:H-91,580,36,20,THEME.muted,'center');
 }
 beginFirstVisit():void{
  if(this.mode!=='home'||!this.save.shouldAutoStartTutorial())return;
  // A returning guest linking an account should not be treated as a new player.
  if(this.save.owner&&this.save.hasGuestProgress())return;
  this.load(0);
  // The prompt will not reappear after leaving the tutorial or reopening the game.
  if(this.model?.index===0)this.save.markTutorialOpened();
 }
 // Render at the artwork's design size; scale the complete live subtree on
 // exceptionally short screens so the text and the hit areas stay together.
 private featurePanel(title:string,height:number,art:string):Laya.Sprite{
  this.hideModal();this.modalOpen=true;this.releasePointers();this.setSystemCursor();this.guide?.clear();
  const shade=new Laya.Sprite();shade.size(W,H);
  shade.graphics.drawRect(0,0,W,H,'rgba(81,57,69,0.28)');
  shade.mouseEnabled=true;shade.on(Laya.Event.CLICK,this,()=>{});
  this.overlay.addChild(shade);this.modalShade=shade;
  const scale=Math.min(1,(H-64)/height),card=new Laya.Sprite();
  card.name='feature-panel';card.size(676,height);card.scale(scale,scale);
  card.pos((W-676*scale)/2,(H-height*scale)/2+8*scale);
  paintFeature(card.graphics,art,676,height);
  card.cacheAs='none';card.mouseEnabled=true;card.on(Laya.Event.CLICK,this,()=>{});
  this.overlay.addChild(card);this.modalCard=card;
  text(card,title,112,42,452,68,48,COLORS.ink,'center',true);
  ornament(card,175,126,326);
  const close=new Button('',584,42,64,58,()=>this.hideModal(),false,'close');
  close.name='button:close-feature';card.addChild(close);
  if(Laya.Tween&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
   card.alpha=0;Laya.Tween.to(card,{alpha:1},140,Laya.Ease.sineOut);
  }
  this.sync();
  return card;
 }
 // Preserve the real Button's input and pressed/disabled layers over the
 // painted silk button. Reward copy and state are never baked into the art.
 private featureAction(card:Laya.Sprite,label:string,x:number,y:number,w:number,h:number,action:()=>void,name:string):Button{
  const button=new Button(label,x,y,w,h,action,true);
  button.name=name;button.skin.graphics.clear();button.label.fontSize=29;
  card.addChild(button);return button;
 }
 openSignIn():void{
  if(this.mode!=='home')return;
  const state=this.save.dailySignInStatus(),card=this.featurePanel('每日签到',884,FEATURE_ART.calendar);
  text(card,'七日有礼 · 每日一礼，玉运常伴',48,141,580,34,23,COLORS.ink,'center',true);
  text(card,'累计第 '+state.todaySlot+' / 7 天',48,174,580,30,22,COLORS.ink,'center',true);
  const w=143,gap=12,left=34,gridTop=202,rowHeight=226,rowTwo=445;
  for(let i=0;i<7;i++){
   const day=i+1,special=day===7;
   const x=left+(i<4?i:i-4)*(w+gap),y=i<4?gridTop:rowTwo;
   const cw=special?w*2+gap:w;
   const already=day<=state.completed,upcoming=day===state.todaySlot&&!state.claimedToday;
   const cell=new Laya.Sprite();cell.pos(x,y);cell.size(cw,rowHeight);
   cell.name='signin-day:'+day;cell.cacheAs='none';cell.mouseEnabled=false;card.addChild(cell);
   if(upcoming)round(cell.graphics,-2,-2,cw+4,rowHeight+4,17,'rgba(255,240,244,0.03)','#d47f96',2);
   text(cell,'第'+day+'天',5,special?-5:10,cw-10,34,special?27:24,COLORS.ink,'center',true);
   const reward=DAILY_REWARDS[i]!;
   if(special){
    for(const [col,kind,count] of [[0,'hint',reward.hint],[1,'erase',reward.erase]] as const){
     const cx=cw*(col===0?.27:.76);
     const t=text(cell,(kind==='hint'?'提示':'消除')+'×'+count,cx-66,156,132,26,21,COLORS.ink,'center',true);
     t.name='signin-reward-label:'+kind;t.wordWrap=false;
    }
   }else{
    const t=text(cell,reward.hint?'提示×'+reward.hint:'消除×'+reward.erase,5,154,cw-10,26,22,COLORS.ink,'center',true);
    t.wordWrap=false;
   }
   const status=already?'已领取':upcoming?'今日可领':'待领取';
   const banner=panel(cell,6,rowHeight-40,cw-12,34,14,upcoming?'#d78b9b':already?'#e4d8d9':'#f1d8d8',upcoming?'#d78b9b':'#f1d8d8');
   banner.name='signin-status:'+day;banner.cacheAs='none';
   const statusLabel=text(banner,status,2,0,cw-16,34,21,upcoming?THEME.white:already?COLORS.muted:COLORS.ink,'center',true);
   statusLabel.wordWrap=false;
  }
  if(state.clockInvalid&&!state.claimedToday)
   text(card,'日期校验异常，请检查设备时间',45,790,586,29,20,COLORS.ink);
  else if(state.claimedToday)
   text(card,'今日奖励已存入背包',45,790,586,29,21,COLORS.muted,'center',true);
  const action=this.featureAction(card,state.claimedToday?'今日已领取':'领取今日奖励',110,707,456,68,()=>this.claimSignIn(),'button:claim-signin');
  action.enabled=!state.claimedToday&&!state.clockInvalid;
 }
 claimSignIn():void{
  if(this.mode!=='home')return;
  const outcome=this.save.claimDaily();
  if(outcome.ok){
   if(this.homeSignDot)this.homeSignDot.visible=false;
   // Refresh the live card only after the atomic local grant has succeeded.
   this.openSignIn();
   // A brief floral reward glint travels towards the bag shortcut.
   if(Laya.Tween&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    const trail=new Laya.Sprite();trail.pos(W/2,H/2);
    trail.graphics.drawCircle(0,0,18,THEME.pink,THEME.rose,1.5);
    icon(trail.graphics,outcome.reward.erase?'erase':'hint',-14,-14,28,THEME.rose);
    trail.mouseEnabled=false;this.overlay.addChild(trail);
    Laya.Tween.to(trail,{x:W-60,y:H-465,alpha:0},560,Laya.Ease.sineOut);
    Laya.timer.frameOnce(38,this,()=>{Laya.Tween?.clearAll(trail);trail.destroy(true)});
   }
   void this.platform.sync();
  }else this.openSignIn();
 }
 openBag():void{
  if(this.mode!=='home')return;
  const card=this.featurePanel('我的背包',714,FEATURE_ART.inventory);
  text(card,'签到好礼 · 收进锦囊，解锁玉环',70,145,536,36,22,COLORS.ink,'center',true);
  const kinds=['hint','erase'] as const;
  for(let i=0;i<2;i++){
   const kind=kinds[i],x=52+i*292;
   const tile=new Laya.Sprite();tile.name='inventory-item:'+kind;tile.pos(x,190);tile.size(278,368);tile.mouseEnabled=false;card.addChild(tile);
   text(tile,kind==='hint'?'提示':'消除',36,5,206,42,29,COLORS.ink,'center',true);
   const n=this.save.inventoryLeft(kind);
   const count=text(tile,'拥有 ×'+n,15,285,248,40,30,COLORS.ink,'center',true);count.name='inventory-count:'+kind;count.wordWrap=false;
   text(tile,kind==='hint'?'指引正确旋转方向':'消除选中的一只玉镯',8,328,262,28,19,COLORS.muted,'center',true);
  }
  text(card,'永久保存 · 进入正式关卡后使用',62,658,552,25,18,COLORS.muted);
  this.featureAction(card,'收好背包',120,583,436,62,()=>this.hideModal(),'button:close-bag');
 }
 practice():void{this.load(this.teachingCurrent())}
 settings():void{
  this.modal('设置',['',''],[
   {label:this.audio.enabled?'声音 开':'声音 关',action:()=>{this.toggleSound();this.settings()},primary:false},
   {label:'新手练习',action:()=>this.practice(),primary:false},
   {label:'关闭',action:()=>this.hideModal(),primary:true}
  ]);
  const card=this.modalCard!;
  for(const [index,kind] of (['music','effects'] as const).entries()){
   const y=139+index*85,label=text(card,'',40,y,270,64,26,COLORS.ink,'center',true);
   const current=()=>kind==='music'?this.audio.musicVolume:this.audio.effectsVolume;
   const refresh=()=>{label.text=(kind==='music'?'背景音乐':'音效音量')+'  '+Math.round(current()*100)+'%'};
   label.name='volume:'+kind;refresh();
   for(const [delta,x] of [[-5,320],[5,440]]){
    const b=new Button(delta<0?'−':'+',x,y,120,64,()=>{
     const value=Math.round(Math.max(0,Math.min(100,Math.round(current()*100)+delta)))/100;
     if(kind==='music')this.audio.musicVolume=value;else {this.audio.effectsVolume=value;this.audio.play('button')}
     refresh();
    },false);b.name='button:volume-'+kind+(delta<0?'-down':'-up');card.addChild(b);
   }
  }
 }
 toggleSound():void{this.audio.enabled=!this.audio.enabled;this.save.data.sound=this.audio.enabled;this.save.persist()}
 teachingCurrent():number{
  for(let index=0;index<TEACHING_COUNT;index++)if(!this.save.data.records[index])return Math.min(index,this.save.data.unlocked);
  return TEACHING_COUNT-1; // All tutorial levels cleared: replay the final one.
 }
 formalCurrent():number{
  let index=TEACHING_COUNT;
  while(index<C.levels.length-1&&this.save.data.records[index])index++;
  return index;
 }
 levels():void{
  this.clear('levels');
  this.scene.addChild(new Button('',30,28,76,66,()=>this.home(),false,'back'));
  text(this.scene,'关卡图谱',160,41,400,70,44,COLORS.ink,'center',true);
  ornament(this.scene,185,140,350);
  const viewport=new Laya.Sprite();viewport.name='atlas-viewport';viewport.pos(0,170);viewport.size(W,H-205);
  viewport.scrollRect=new Laya.Rectangle(0,0,W,H-205);this.scene.addChild(viewport);
  this.atlas=new Laya.Sprite();viewport.addChild(this.atlas);
  this.atlasHeight=H-205;this.atlasPage=-1;
  this.scrollAtlas(Math.floor((this.formalCurrent()-TEACHING_COUNT)/20)*this.atlasHeight);
 }
 scrollAtlas(offset:number):void{
  if(!this.atlas)return;
  const total=C.levels.length-TEACHING_COUNT,pages=Math.max(1,Math.ceil(total/20));
  this.atlasOffset=Math.max(0,Math.min((pages-1)*this.atlasHeight,offset));
  this.atlas.y=-this.atlasOffset;
  const page=Math.floor(this.atlasOffset/this.atlasHeight);
  if(page===this.atlasPage)return;
  this.atlasPage=page;
  // Keep only the visible page and its neighbours alive, including when scrolling backwards.
  const parent=this.atlas.parent!;this.atlas.destroy(true);
  this.atlas=new Laya.Sprite();this.atlas.y=-this.atlasOffset;parent.addChild(this.atlas);
  const current=this.formalCurrent(),w=148,gap=18,h=Math.min(132,Math.floor((this.atlasHeight-90)/5)-16);
  for(let p=Math.max(0,page-1);p<=Math.min(pages-1,page+1);p++){
   for(let j=p*20;j<Math.min(total,(p+1)*20);j++){
    const index=TEACHING_COUNT+j,slot=j%20,locked=index>current&&!this.save.data.records[index];
    const x=37+(slot%4)*(w+gap),y=p*this.atlasHeight+12+Math.floor(slot/4)*(h+16);
    const card=new Button('',x,y,w,h,()=>{if(performance.now()>=this.atlasClickAfter&&!this.atlasDrag?.moved)this.load(index)});
    card.name='formal-level:'+String(j+1);card.enabled=!locked;this.atlas.addChild(card);
    if(locked){card.skin.graphics.clear();card.skin.graphics.drawRect(0,0,w,h,'#e4e3e0');}
    text(card,'第'+(j+1)+'关',4,9,w-8,44,27,locked?'#999b99':COLORS.ink,'center',true);
    const marks=new Laya.Sprite();marks.mouseEnabled=false;card.addChild(marks);
    if(locked)icon(marks.graphics,'lock',(w-28)/2,h-42,28,'#999b99');
    else for(let k=0;k<3;k++)icon(marks.graphics,'star',(w-88)/2+k*31,h-40,26,k<(this.save.data.records[index]?.stars||0)?COLORS.gold:'#b7b9b7');
   }
  }
 }
 atlasDown(e:GamePointer):void{
  if(!this.atlas||this.mode!=='levels'||(e.button!==undefined&&e.button!==0))return;
  const p=this.point(e);if(p.y<170||p.y>H-35)return;
  this.atlasDrag={id:e.pointerId,y:p.y,offset:this.atlasOffset,moved:false};

 }
 atlasMove(e:GamePointer):void{
  const drag=this.atlasDrag;if(!drag||drag.id!==e.pointerId)return;
  const delta=this.point(e).y-drag.y;
  if(Math.abs(delta)>10)drag.moved=true;
  if(drag.moved){this.atlasClickAfter=performance.now()+300;this.scrollAtlas(drag.offset-delta)}
 }
 atlasUp(e:GamePointer):void{
  if(this.atlasDrag?.id!==e.pointerId)return;
  if(this.atlasDrag.moved)this.atlasClickAfter=performance.now()+300;
  this.atlasDrag=null;

 }
 teachingLevels():void{
  this.clear('levels');
  this.scene.addChild(new Button('',30,28,76,66,()=>this.home(),false,'back'));
  text(this.scene,'教程关卡',130,37,460,75,43,COLORS.ink,'center',true);
  text(this.scene,'由浅入深，学习转镯和解扣',80,137,560,45,24,COLORS.muted);
  ornament(this.scene,185,202,350);
  const rowH=Math.min(170,Math.floor((H-382)/5)-12);
  for(let i=0;i<TEACHING_COUNT;i++){
   const x=i%2?378:42,y=240+Math.floor(i/2)*(rowH+12),locked=i>this.save.data.unlocked;
   const entry=new Button('',x,y,300,rowH,()=>this.load(i));
   entry.name='teaching-level:'+String(i+1);entry.enabled=!locked;this.scene.addChild(entry);
   text(entry,'第'+(i+1)+'关',20,8,260,48,31,COLORS.ink,'left',true);
   text(entry,C.levels[i].name,20,56,260,38,23,COLORS.ink,'left');
   text(entry,locked?'尚未解锁':this.save.data.records[i]?'已完成 · 再次练习':'点击开始练习',20,rowH-44,260,34,19,COLORS.muted,'left');
  }
  text(this.scene,'完成前一关后，后续教程会逐步开放',64,H-87,592,44,21,COLORS.muted);
 }
 load(i:number,restart=false):void{
  if(i<0||i>=C.levels.length||(i<TEACHING_COUNT&&i>this.save.data.unlocked))return;
  this.clear('game');this.settled=false;this.model=new GameModel(i);if(debugEnabled())this.save.taint();
  this.hintLeft=1;this.eraseLeft=0;
  if(this.formal){
   const saved=this.save.readRun(i);
   if(!restart&&saved){this.model.state=saved.state;this.model.selected=null;this.model.resetHint(saved.hintProgress||0);this.hintLeft=saved.hint;this.eraseLeft=0}
   if(restart){this.save.clearRun(i);this.save.resetRewards(i)}
  }
  if(this.formal){
   // The wallpaper must be behind the *entire cached gameplay scene*, not
   // another child of it: otherwise Laya's bitmap cache can flatten it
   // against the tray and obscure the original artwork.
   const wallpaper=this.image(this.root,HOME_BG,W/2,H/2,W,H);
   wallpaper.name='formal-wallpaper';wallpaper.zOrder=-10;
   this.wallpaper=wallpaper;
   const home=new Button('',28,26,76,64,()=>this.confirmExit(),false,'home');home.name='button:home';this.scene.addChild(home);
   const restart=new Button('',116,26,76,64,()=>this.confirmRestart(),false,'restart');restart.name='button:restart';this.scene.addChild(restart);
   const title=text(this.scene,'第'+(i-TEACHING_COUNT+1)+'关',216,26,288,64,43,COLORS.ink,'center',true);
   const sound=new Button('',528,26,76,64,()=>{this.toggleSound();sound.setIcon(this.audio.enabled?'sound':'mute')},false,this.audio.enabled?'sound':'mute');sound.name='button:sound';this.scene.addChild(sound);
   const help=new Button('',616,26,76,64,()=>this.help(),false,'help');help.name='button:help';this.scene.addChild(help);
   // Both counters share one non-wrapping line under the level title.
   this.status=text(this.scene,'',90,101,540,34,23,COLORS.ink,'center');
   this.status.wordWrap=false;
  }else{
  panel(this.scene,105,105,510,113,22,THEME.white,THEME.faint);
  const practiceHome=new Button('',28,26,76,64,()=>this.home(),false,'home');practiceHome.name='button:home';this.scene.addChild(practiceHome);
  const chapters=new Button('教程关卡',112,26,190,64,()=>this.teachingLevels(),false,'map');
  chapters.name='button:teaching-levels';this.scene.addChild(chapters);
  const sound=new Button(this.audio.enabled?'声音开':'声音关',402,26,160,64,()=>{
   this.toggleSound();sound.label.text=this.audio.enabled?'声音开':'声音关';
   sound.setIcon(this.audio.enabled?'sound':'mute');
  },false,this.audio.enabled?'sound':'mute');sound.name='button:sound';this.scene.addChild(sound);
  const help=new Button('玩法',572,26,120,64,()=>this.help(),false,'help');
  help.name='button:help';this.scene.addChild(help);
  text(this.scene,'教学 '+String(i+1).padStart(2,'0')+' 境 · '+C.levels[i].name,50,110,620,64,39,COLORS.ink,'center',true);
  this.status=text(this.scene,'',70,179,580,38,21,COLORS.ink);
  ornament(this.scene,176,229,368);
  }
  if(this.formal){
   const plateH=H-244,plateY=142;
   // Full-width play area; overscan the original tray uniformly.
   const trayW=W+32,trayH=plateH*trayW/710;
   const tray=this.image(this.scene,TRAY,W/2,plateY+plateH/2,trayW,trayH);tray.name='board-tray';
   this.board=new Board(this.scene,{x:0,y:plateY+12,w:W,h:plateH-24});this.board.load(this.model.state,{w:trayW,h:trayH});
   this.board.attachBackdrop([this.garden!,tray]);
   const y=H-84;
   this.hintButton=new Button('提示',28,y,146,62,()=>void this.hint(),false,'hint');this.scene.addChild(this.hintButton);
   this.scene.addChild(new Button('−',208,y,76,62,()=>this.zoomView(1/1.35)));
   this.scene.addChild(new Button('全盘',298,y,124,62,()=>{this.releasePointers();this.board!.resetView();this.syncView()}));
   this.scene.addChild(new Button('+',436,y,76,62,()=>this.zoomView(1.35)));
   this.eraseButton=new Button('消除',548,y,144,62,()=>this.toggleErase(),false,'erase');
   this.eraseButton.name='button:erase';this.scene.addChild(this.eraseButton);
   this.toolNoticeBox=panel(this.overlay,62,H-300,596,106,20,THEME.white,THEME.line);
   this.toolNoticeBox.name='tool-notice';this.toolNoticeBox.zOrder=-1;this.toolNoticeBox.cacheAs='none';
   this.eraseTip=text(this.toolNoticeBox,'请点击要消除的手镯',20,12,556,82,30,COLORS.ink,'center',true);
   this.toolNoticeBox.visible=false;
   this.syncView();
  }else{
  // Reuse the former lower-caption space so the whole jade tray is taller.
  const plateH=H-370;
  const tray=this.image(this.scene,TRAY,360,236+plateH/2,710,plateH);tray.name='board-tray';
  this.board=new Board(this.scene,{x:73,y:278,w:574,h:H-558});this.board.load(this.model.state);
  this.board.attachBackdrop([this.garden!,tray]);
  // Upper-left speech bubble: tutorial instructions stay close to the action.
  const bubble=panel(this.scene,63,262,552,86,19,THEME.white,THEME.faint);
  bubble.name='tutorial-instruction';
  bubble.graphics.drawPoly(39,84,[0,0,32,0,10,19],THEME.white,THEME.faint,1.1);
  text(bubble,'手指按住玉镯转动，让玉镯缺口对准锁扣',22,9,512,68,24,COLORS.ink,'left');
  // Show live messages over the empty lower lip, not outside the tray.
  panel(this.scene,35,H-257,650,112,20,THEME.white,THEME.faint);
  this.guideTitle=text(this.scene,'解镯小提示',60,H-248,500,33,20,COLORS.gold,'left');
  const tips=['拖动粉色 B 镯，把缺口转向两镯之间的空心扣。','带 × 的锁杆留在原地，两只手镯各对齐自己的扣。','先解外围 B 镯，再观察留下的完整锁杆。'];
  this.message=text(this.scene,tips[i]||C.levels[i].tip,60,H-215,520,60,22,COLORS.ink,'left');
  this.scene.addChild(new Button('重开',80,H-108,260,68,()=>this.load(i),false,'restart'));
  this.hintButton=new Button('提示',380,H-108,260,68,()=>void this.hint(),false,'hint');
  this.scene.addChild(this.hintButton);
  }
  this.sync();
  if(i<3&&this.save.data.tutorial<=i&&!this.save.data.records[i])this.startGuide();
 }
 startGuide():void{
  if(!this.model||!this.board||this.formal)return;this.stopGuide(false);
  const first=solutions[this.model.index][0];this.guide=new Guide(this.scene,this.board,first.id);
  this.guideTitle!.text=this.model.index===0?'新手 · 1 / 2  找到粉色 B 镯':this.model.index===1?'新机关 · 背景固定扣':'新机关 · 保留的锁杆';
  this.guideTitle!.width=490;this.message!.width=500;
  this.guideSkip=new Button('跳过',578,H-240,88,52,()=>this.stopGuide(true));this.scene.addChild(this.guideSkip);
  this.guide.draw(this.model.state,performance.now(),false);
 }
 stopGuide(remember=false):void{
  if(remember&&this.model){this.save.data.tutorial=Math.max(this.save.data.tutorial,this.model.index+1);this.save.persist()}
  this.guide?.destroy();this.guide=null;this.guideSkip?.destroy();this.guideSkip=null;
  if(this.guideTitle){this.guideTitle.text='解镯小提示';this.guideTitle.width=500}
  if(this.message)this.message.width=520;
 }
 guideSelect(id:string):void{
  if(!this.guide||!this.model)return;
  if(this.formal){this.stopGuide(false);return}
  if(this.guide.action)return; // A directional hint is passive, not forced guidance.
  if(id!==this.guide.id){this.say('先试试 '+this.guide.id+' 镯。藕粉色角标标出了它要对齐的扣。');return}
  this.guide.phase='turn';
  if(this.model.index===0){this.guideTitle!.text='新手 · 2 / 2  拖动，让缺口对准扣';this.say('手指沿粉色 B 镯转一转，缺口对准藕粉色角标里的空心扣。')}
 }
 say(content:string):void{if(this.message)this.message.text=content}
 sync(redraw=true):void{
  if(!this.model||!this.board)return;
  const s=this.model.state,n=s.rings.filter(r=>r.life==='active').length;
   this.status!.text='剩余 '+n+' 个  ·  已转 '+s.steps+' 次'+(!this.formal&&this.model.selected?'  ·  选中 '+this.model.selected:'');
  this.board.selected=this.model.selected;if(redraw)this.board.draw(s);this.syncTools();if(!this.drag)this.persistRun();
  this.controls.forEach(b=>b.enabled=!this.busy&&!this.board!.animating&&!!this.model!.selected&&!this.modalOpen);
  if(this.undoButton)this.undoButton.enabled=this.model.history.length>0&&!this.modalOpen;
  if(this.demoButton)this.demoButton.label.text=this.busy?'停止':'演示';
  if(this.hintButton)this.hintButton.enabled=!this.busy&&!this.platform.rewardBusy&&!this.board.animating&&!this.modalOpen;
  if(this.eraseButton)this.eraseButton.enabled=!this.busy&&!this.platform.rewardBusy&&!this.board.animating&&!this.modalOpen;
 }
 releaseDrag(releaseCapture=true):void{
  this.audio.stopMotion();this.audio.resetContact();
  const d=this.drag;this.drag=null;
  if(d&&releaseCapture)this.pointers.delete(d.pointer);
 }
 cancel():void{
  this.audio.stopAll();
  if(this.guide?.followRotation)this.stopGuide(false);
  this.epoch++;this.busy=false;this.releasePointers();

  this.finishPlan?.(null);this.finishPlan=null;
  if(this.demoButton)this.demoButton.label.text='演示';
  this.sync();
 }
 point(e:GamePointer):Point{
  return{x:e.stageX/RENDER_SCALE,y:e.stageY/RENDER_SCALE};
 }
 setSystemCursor():void{
  setGameCursorHidden(!Laya.Browser.onMobile&&!this.modalOpen);
 }
 moveHand(e:GamePointer):void{
  if(this.modalOpen||this.busy)return;
  const p=this.point(e);
  if(this.mode!=='game'&&Laya.Browser.onMobile)return;
  if(this.activeHandPointer===e.pointerId){
   // The pivot is already the fingertip: the image follows the real contact.
   this.cursorHand.place(p);return;
  }
  // Desktop hover replaces the arrow even before clicking the jade ring.
  if(!Laya.Browser.onMobile){
   if(p.x>=0&&p.x<=W&&p.y>=0&&p.y<=H)this.cursorHand.place(p);
   else this.cursorHand.hide();
  }
 }
 releasePointers():void{
  this.releaseDrag();this.eraseTap=null;this.pointers.clear();this.viewGesture=null;
  this.activeHandPointer=null;this.cursorHand.hide();
 }
 syncView():void{
  if(!this.board)return;
  if(this.viewLabel)this.viewLabel.text=Math.round(this.board.zoom/this.board.fitZoom*100)+'% · '+'双指缩放 / 移动 · 拖空白移动 · 拖玉镯旋转';
 }
 zoomView(factor:number):void{
  if(!this.board||this.modalOpen)return;this.releasePointers();const r=this.board.rect;
  this.board.zoomTo(this.board.zoom*factor,{x:r.x+r.w/2,y:r.y+r.h/2});this.syncView();
 }
 down(e:GamePointer):void{
  if(this.platform.rewardBusy)return;
  this.audio.wake();
  if(this.mode!=='game'||!this.model||!this.board||this.busy||this.board.animating||this.modalOpen||(e.button!==undefined&&e.button!==0))return;
  const p=this.point(e);if(!this.board.contains(p))return;
  this.pointers.set(e.pointerId,p);
  if(this.pointers.size>=2){
   this.activeHandPointer=null;this.cursorHand.hide();
   this.eraseTap=null;this.releaseDrag(false);const [a,b]=[...this.pointers.values()];const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   this.viewGesture={kind:'pinch',start:mid,screen:{...this.board.screen},zoom:this.board.zoom,distance:Math.max(1,C.dist(a,b)),anchor:this.board.toWorld(mid)};return;
  }
  this.activeHandPointer=e.pointerId;this.cursorHand.place(p);
  if(this.eraseMode){
   // Select only on pointerup: moving or pinching must not consume the item.
   const target=this.board.pick(p,this.model.state);
   if(target){this.eraseTap={id:target.id,pointer:e.pointerId,start:p};return}
   this.viewGesture={kind:'pan',start:p,screen:{...this.board.screen},zoom:this.board.zoom,distance:0,anchor:p};return;
  }
  const ring=this.panMode?undefined:this.board.pick(p,this.model.state);
  if(!ring){this.viewGesture={kind:'pan',start:p,screen:{...this.board.screen},zoom:this.board.zoom,distance:0,anchor:p};return}
  this.model.selected=ring.id;this.board.hint=null;this.guideSelect(ring.id);
  this.drag={id:ring.id,pointer:e.pointerId,last:C.angle(ring,this.board.toWorld(p)),started:false,blocked:false};
  this.audio.play('select');this.sync();
 }
 move(e:GamePointer):void{
  this.moveHand(e);
  if(!this.pointers.has(e.pointerId)||!this.model||!this.board||this.busy||this.modalOpen)return;
  const point=this.point(e);this.pointers.set(e.pointerId,point);
  if(this.eraseTap?.pointer===e.pointerId){
   if(C.dist(point,this.eraseTap.start)<=12)return;
   const start=this.eraseTap.start;this.eraseTap=null;
   this.viewGesture={kind:'pan',start,screen:{...this.board.screen},zoom:this.board.zoom,distance:0,anchor:start};
  }
  const gesture=this.viewGesture;
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
  const result=this.perform(d.id,delta);
  // Preserve the last physical contact result until pointer-up. A blocked drag
  // must not be magnetically moved to a *different* legal gap on release.
  d.blocked=!!result.blocked;
  // Engage magnetic alignment during deliberate slow adjustment; rapid swipes must not
  // jump ahead of the moving finger or spoil multi-step alignment routes.
  if(!result.blocked&&!result.removed.length&&Math.abs(delta)<=1.5)this.snap(d.id,delta);
 }
 up(e:GamePointer):void{
  const d=this.drag?.pointer===e.pointerId?this.drag:null;
  const erase=this.eraseTap?.pointer===e.pointerId?this.eraseTap:null;
  if(erase)this.eraseTap=null;
  this.pointers.delete(e.pointerId);if(d)this.releaseDrag();
  if(this.activeHandPointer===e.pointerId){
   this.activeHandPointer=null;
   if(Laya.Browser.onMobile)this.cursorHand.hide();
   else this.cursorHand.place(this.point(e));
  }

  if(!this.pointers.size)this.viewGesture=null;
  if(d?.started&&!d.blocked&&!this.busy&&!this.board?.animating)this.snap(d.id);
  if(erase&&this.eraseMode)this.chooseEraseTarget(erase.id);
  this.persistRun();
 }
 snap(id:string,motion=0):void{
  if(!this.model)return;
  const delta=snapDelta(this.model.state,id,motion);
  if(delta!==null){const res=this.perform(id,delta);if(!res.blocked)this.haptics.pulse('snap')}
 }
 manual(delta:number):void{
  if(this.formal||!this.model||!this.model.selected||this.busy||this.board?.animating||this.modalOpen)return;
  this.guideSelect(this.model.selected);this.audio.resetContact();this.model.begin();this.board!.hint=null;this.perform(this.model.selected,delta);
 }
 perform(id:string,d:number):Result{
  const model=this.model!,before=C.clone(model.state),res=model.turn(id,d);
  if(res.done){this.audio.motion(res.done);if(!res.blocked)this.audio.resetContact()}
  if(res.removed.length){
   this.haptics.pulse('snap');
   this.releaseDrag();this.board!.release(before,model.state,res.removed);this.audio.play('clear');
   this.say(res.removed.join('、')+' 已解开。观察下一只手镯的扣位。');
   if(this.guide&&res.removed.includes(this.guide.id))this.stopGuide(true);
  }else if(res.blocked){
   this.board!.blocked=res.blocked;this.board!.blockUntil=performance.now()+550;
   this.board!.blockedRing=id;this.haptics.pulse('blocked');
   this.audio.collision(id+':'+res.blocked.rod+':'+res.blocked.target,Math.min(1,Math.abs(d)/8));
   this.say(res.blocked.kind==='captive'?id+' 的锁杆还套在 '+res.blocked.target+' 上，先处理 '+res.blocked.target+'。':id+' 的锁杆被挡住了。试试反向转动，或先拆旁边的手镯。');
  }else{
   const aligned=model.state.rods.some(z=>C.exists(model.state,z)&&C.endpoints(model.state,z).some((e,j)=>e.id===id&&model.state.states[z.id][j]==='aligned'));
   if(aligned){
    this.say(id+' 已对齐，保持这个位置，再调整其他扣位。');
    const entered=model.state.rods.some(z=>C.exists(model.state,z)&&C.endpoints(model.state,z).some((e,j)=>
     e.id===id&&model.state.states[z.id][j]==='aligned'&&before.states[z.id]?.[j]!=='aligned'));
    if(entered){this.audio.play('align');this.haptics.pulse('snap')}
   }
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
   const iterator=search(s);let cancelled=false;
   const finish=(p:Action[]|null)=>{if(cancelled)return;cancelled=true;this.finishPlan=null;resolve(p)};
   this.finishPlan=finish;const started=performance.now();
   const step=()=>{
    if(cancelled)return;
    if(performance.now()-started>20000){finish(null);return}
    const start=performance.now();
    for(let n=0;n<12;n++){
     const result=iterator.next();if(result.done){finish(result.value);return}
     if(performance.now()-start>=3)break;
    }
    Laya.timer.frameOnce(1,this,step);
   };
   Laya.timer.frameOnce(1,this,step);
  });
 }
 async hint():Promise<void>{
  if(this.busy||this.modalOpen||this.board?.animating||!this.model)return;
  if(!this.debugMode&&this.formal&&this.toolLeft('hint')===0){this.offerReward('hint');return}
  if(this.guide?.action&&this.formal)return;
  this.busy=true;const token=++this.epoch;this.say('正在观察当前扣位…');if(this.hintButton)this.hintButton.label.text='观察…';this.sync(!this.formal);
  // Formal hint = direct lookup of precomputed DAG/stage data. No Worker.
  const a=this.formal?this.model.hints?.next(this.model.state)||null:(await this.plan())?.[0]||null;
  if(token!==this.epoch)return;
  this.busy=false;if(this.hintButton)this.hintButton.label.text='提示';
  if(!a){if(this.formal)this.toolNotice('当前暂无可执行提示，未扣次数');this.say('当前没有可执行的提示动作，可以调整扣位后再试。');if(this.hintButton)this.hintButton.label.text='暂无路线';this.sync(!this.formal);return}
  if(!C.ring(this.model.state,a.id)||!Number.isFinite(a.delta)||!a.delta){this.sync(!this.formal);return}
  this.model.selected=a.id;
  if(this.formal){
   this.releasePointers();this.stopGuide(false);
   const ring=C.ring(this.model.state,a.id)!;
   const p=this.board!.toScreen(ring),radius=(C.R+C.BAND/2+22)*this.board!.zoom,b=this.board!.rect;
   if(p.x-radius<b.x||p.x+radius>b.x+b.w||p.y-radius<b.y||p.y+radius>b.y+b.h){
    const offset=C.rot({x:ring.x-this.board!.center.x,y:ring.y-this.board!.center.y},this.board!.turn);
    this.board!.panTo({x:b.x+b.w/2-offset.x*this.board!.zoom,y:b.y+b.h/2-offset.y*this.board!.zoom});
   }
   this.guide=new Guide(this.scene,this.board!,a.id,a);this.guide.phase='turn';
   // The hint owns its graphics. State is unchanged; panTo already redraws if
   // needed. Rebuilding every static clasp twice made dense-board hints stall.
   if(!this.debugMode)this.consumeTool('hint');
   if(this.debugMode){await this.rotateHint(a,token);return}
   this.guide.draw(this.model.state,performance.now(),false);this.sync(false);return;
  }
  // Same unobtrusive guided hand used for hard levels; never block input.
  this.releasePointers();this.stopGuide(false);this.board!.hint=null;
  this.guide=new Guide(this.scene,this.board!,a.id,a);this.guide.phase='turn';
  if(this.debugMode){await this.rotateHint(a,token);return}
  this.guide.draw(this.model.state,performance.now(),false);
  this.say('跟着手指，'+(a.delta>0?'顺时针':'逆时针')+'转动 '+a.id+' 镯，让缺口对准锁扣。');
  this.sync();
 }
 async rotateHint(action:Action,token:number):Promise<void>{
  const model=this.model,board=this.board,guide=this.guide;
  if(!model||!board||!guide)return;
  this.busy=true;guide.followRotation=true;model.begin();this.sync(false);
  guide.draw(model.state,performance.now(),false);
  let remaining=action.delta;
  try{
   // One press executes one verified hint action, including multi-stage alignments.
   // Reuse normal rotation for collision, release, audio, haptics and persistence.
   while(Math.abs(remaining)>.001){
    await nextFrame();
    if(token!==this.epoch||this.model!==model||this.board!==board)return;
    if(this.modalOpen){this.cancel();return}
    const amount=Math.sign(remaining)*Math.min(2.4,Math.abs(remaining));
    const res=this.perform(action.id,amount);remaining-=res.done;
    guide.lastDraw=0;
    if(this.guide===guide)guide.draw(model.state,performance.now(),false);
    if(res.blocked||Math.abs(res.done)<.001||C.ring(model.state,action.id)?.life!=='active')break;
   }
   this.audio.stopMotion();
   if(this.guide===guide)this.stopGuide(false);
   while(board.animating){await nextFrame();if(token!==this.epoch)return}
  }finally{
   if(token===this.epoch){this.busy=false;this.audio.stopMotion();if(this.guide===guide)this.stopGuide(false);this.sync()}
  }
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
    await nextFrame();
   }
   while(this.board.animating){if(token!==this.epoch)return;await nextFrame()}
  }
  if(token!==this.epoch)return;this.busy=false;this.sync();
 }
 tick():void{
  if(this.platformLive&&this.modalCard===this.platformLive.card&&Date.now()>=this.nextPlatformRefresh){
   this.nextPlatformRefresh=Date.now()+1000;const lines=this.platformLive.read();this.platformLive.labels.forEach((label,i)=>label.text=lines[i]||'');
  }
  if(this.platformViewPending&&this.mode==='home'&&!this.modalOpen&&this.platform.states.cloud!=='busy'){
   this.platformViewPending=false;this.audio.enabled=this.save.data.sound;this.home();
   if(this.platform.pendingCloud)this.showCloudConflict();
  }
  if(this.mode==='home'&&this.homeSignDot&&Date.now()>=this.nextSignBadgeCheck){
   this.nextSignBadgeCheck=Date.now()+60000;
   const state=this.save.dailySignInStatus();
   this.homeSignDot.visible=!state.claimedToday&&!state.clockInvalid;
  }
  if(Date.now()>=this.nextCloudCheck){this.nextCloudCheck=Date.now()+1000;void this.platform.sync()}
  if(this.platform.rewardBusy)return;
  this.audio.tick(performance.now());
  const now=performance.now();
  if(this.board?.blockedRing&&now>=this.board.blockUntil){this.board.blockedRing=null;if(this.model)this.board.draw(this.model.state)}
  if(this.noticeUntil&&now>this.noticeUntil){this.noticeUntil=0;if(this.toolNoticeBox){this.toolNoticeBox.visible=this.eraseMode;if(this.eraseMode&&this.eraseTip)this.eraseTip.text='请选择要消除的手镯'}}
  if(!this.model||!this.board||this.mode!=='game')return;
  if(this.guide&&!this.modalOpen)this.guide.draw(this.model.state,now,!!this.drag);
  if(this.board.animating||this.board.sparks.length||this.board.hint||performance.now()<this.board.blockUntil)this.board.draw(this.model.state);
  this.controls.forEach(b=>b.enabled=!this.busy&&!this.board!.animating&&!!this.model!.selected&&!this.modalOpen);
  if(this.hintButton)this.hintButton.enabled=!this.busy&&!this.platform.rewardBusy&&!this.board.animating&&!this.modalOpen;
  if(this.eraseButton)this.eraseButton.enabled=!this.busy&&!this.platform.rewardBusy&&!this.board.animating&&!this.modalOpen;
  if(this.model.cleared&&!this.board.animating&&!this.busy&&!this.settled){this.settled=true;this.win()}
 }
 win():void{
  if(!this.model)return;const i=this.model.index,steps=this.model.state.steps;
  this.save.clearRun(i);
  if(this.formal){
   const stars=this.save.win(i,steps,solutions[i].length,!debugEnabled()),last=i===C.levels.length-1,level='第'+(i-TEACHING_COUNT+1)+'关';
   void this.platform.sync();void this.platform.submitScores().catch(()=>{});this.audio.play('win');
   this.modal(level+' · 全部解开',['★'.repeat(stars)+'☆'.repeat(3-stars),C.levels[i].points.length+' 只玉镯全部解开 · '+steps+' 次转动',last?'最后一关已解开，随时回来再挑战。':'通关成绩已记录，下一关再多一只玉镯。'],[
    {label:last?'关卡图谱':'下一关',action:()=>last?this.levels():this.load(i+1),primary:true},
    {label:'回到首页',action:()=>this.home(),primary:false},
    {label:'再挑战一次',action:()=>this.load(i,true),primary:false}
   ]);return;
  }
  const stars=this.save.win(i,steps,solutions[i].length,!debugEnabled());if(i<3){this.save.data.tutorial=Math.max(this.save.data.tutorial,i+1);this.save.persist()}this.stopGuide(false);this.audio.play('win');
  this.modal(i===9?'十境皆通':'这一境，解开了',['★'.repeat(stars)+'☆'.repeat(3-stars),C.levels[i].name+' · '+steps+' 次转动',i===9?'玉环十境全部完成，随时回来再解。':'下一境已开启，机关会再多一点变化。'],[
   {label:i===9?'进入正式关卡':'进入第 '+(i+2)+' 境',action:()=>i===9?this.levels():this.load(i+1),primary:true},
   {label:'再解一次',action:()=>this.load(i,true),primary:false}
  ]);
 }
 confirmExit():void{
  if(!this.formal||!this.model||this.modalOpen)return;
  this.modal('返回首页？',['当前盘面和道具余量会保留，下次进入可继续。'],[
   {label:'继续解镯',action:()=>this.hideModal(),primary:true},
   {label:'确认返回',action:()=>this.home(),primary:false}
  ]);
 }
 confirmRestart():void{
  if(!this.formal||!this.model||this.modalOpen)return;
  const index=this.model.index;
  this.modal('重新开始？',['当前盘面将重置，免费提示恢复1次。','消除初始为0次，视频和分享奖励次数重置。'],[
   {label:'继续解镯',action:()=>this.hideModal(),primary:true},
   {label:'确认重开',action:()=>this.load(index,true),primary:false}
  ]);
 }
 toggleErase():void{
  if(!this.formal||!this.model||!this.board||this.modalOpen||this.busy||this.board.animating)return;
  if(!this.debugMode&&this.toolLeft('erase')===0){this.offerReward('erase');return}
  this.releasePointers();this.stopGuide(false);
  this.eraseMode=!this.eraseMode;
  this.syncEraseUI();
 }
 syncEraseUI():void{
  this.syncTools();
  if(this.eraseTip)this.eraseTip.text='请选择要消除的手镯';
  this.noticeUntil=0;
  if(this.toolNoticeBox)this.toolNoticeBox.visible=this.eraseMode;
 }
 chooseEraseTarget(id:string):void{
  if(!this.eraseMode||!this.formal||!this.model||!this.board||this.busy||this.board.animating||this.modalOpen)return;
  const target=C.ring(this.model.state,id);
  if(!target||target.life!=='active')return;
  this.eraseMode=false;this.syncEraseUI();
  this.model.selected=id;this.board.selected=id;this.sync();
  this.modal('确认消除手镯？',['将使用消除道具移除选中的一只手镯。','该手镯上的活动扣会一起消失。'],[
   {label:'取消',action:()=>this.hideModal(),primary:false},
   {label:'确认消除',action:()=>this.eraseRing(id),primary:true}
  ]);
 }
 eraseRing(id:string):void{
  if(!this.formal||!this.model||!this.board||!this.debugMode&&this.toolLeft('erase')===0)return;
  const before=C.clone(this.model.state);
  const removed=this.model.removeWithTool(id);
  this.hideModal();
  if(!removed.length)return;
  if(!this.debugMode)this.consumeTool('erase');
  this.releasePointers();this.stopGuide(false);this.board.hint=null;
  this.board.release(before,this.model.state,removed);
  this.audio.play('tool');
  this.sync();
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
  this.hideModal();this.modalOpen=true;this.releasePointers();this.setSystemCursor();
  this.guide?.clear();const shade=new Laya.Sprite();shade.size(W,H);shade.graphics.drawRect(0,0,W,H,'rgba(81,57,69,0.28)');shade.mouseEnabled=true;
  shade.on(Laya.Event.CLICK,this,()=>{});this.overlay.addChild(shade);this.modalShade=shade;
  const height=Math.min(H-150,250+lines.length*85+actions.length*84),card=panel(this.overlay,50,(H-height)/2,620,height,28,THEME.white,THEME.line);
  // A modal hosts buttons whose state changes during pointer dispatch.
  // Never bitmap-cache this entire dynamic subtree.
  card.cacheAs='none';
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
  this.platformLive=null;
  // Modal actions run during Laya's CLICK dispatch. Destroying the clicked
  // button and its parents synchronously can leave stale render/hit state.
  // Hide both layers now, then release them after the current input frame.
  const card=this.modalCard,shade=this.modalShade;
  this.modalCard=null;this.modalShade=null;this.modalOpen=false;this.setSystemCursor();
  if(card){Laya.Tween?.clearAll(card);card.visible=false;card.mouseEnabled=false}
  if(shade){shade.visible=false;shade.mouseEnabled=false}
  if(card||shade)Laya.timer.frameOnce(1,this,()=>{card?.destroy(true);shade?.destroy(true)});
  // Closing settings must never remove or leave the home shortcut invisible.
  const settings=this.homeSettingsButton;
  if(this.mode==='home'&&settings){
   // Reattach defensively if the engine detached the button during input.
   if(settings.parent!==this.scene)this.scene.addChild(settings);
   settings.visible=true;settings.enabled=true;settings.alpha=1;
  }
  if(this.model&&this.board)this.sync();
 }
}
async function boot():Promise<void>{
 // Load the compact Chinese fonts before Laya measures or caches any UI text.
 // The 2D game needs no WebGL2 features. WebGL1 keeps scene caches single-sampled
 // instead of allocating 4x MSAA targets for the magnified photographic board.
 Laya.Config.useWebGL2=false;
 await Laya.init(W,H);
 const viewportWidth=Laya.Browser.clientWidth,viewportHeight=Laya.Browser.clientHeight;
 // Portrait layouts follow the screen ratio without side gutters.
 // Landscape keeps the former minimum play height until it has dedicated HUD layout.
 const fullHeight=viewportHeight/Math.max(1,viewportWidth)*W;
 H=Math.round(viewportHeight>=viewportWidth?fullHeight:Math.max(1180,fullHeight));
 RENDER_W=viewportWidth<600?Math.min(W,Math.round(viewportWidth*1.5)):W;RENDER_SCALE=RENDER_W/W;
 Laya.stage.size(RENDER_W,Math.round(H*RENDER_SCALE));Laya.stage.scaleMode=Laya.Stage.SCALE_SHOWALL;Laya.stage.screenMode=Laya.Stage.SCREEN_NONE;
 Laya.stage.alignH='center';Laya.stage.alignV='middle';Laya.stage.bgColor=THEME.paper;
 await Laya.loader.load(['assets/fonts/jade-song.woff','assets/fonts/jade-text.woff']);
 await Laya.loader.load(ASSETS);const g=new Game();await g.audio.load().catch(e=>console.warn('Recorded audio unavailable',e));finishWebShell();void g.platform.reportReady(performance.now()-BOOT_STARTED);
 if(debugEnabled()){
  exposeDebug({game:g,Core:C,getState:()=>g.model?C.clone(g.model.state):null});
 }
}
boot().catch(e=>{
 console.error(e);failWebShell();
});




