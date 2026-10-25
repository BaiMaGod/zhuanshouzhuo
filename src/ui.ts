import {FEATURE_ART} from './feature-art.js';
// One palette for menus, HUD, tutorial and dialogs. Jade artwork keeps its own colours.
export const THEME={paper:'#fcf7f3',ink:'#684853',muted:'#927881',rose:'#b9788a',pink:'#f0dce1',line:'#c797a3',faint:'#ead4da',white:'#fffaf7',pressed:'#a96478'};
export const COLORS={ink:THEME.ink,muted:THEME.muted,gold:THEME.rose,jade:THEME.rose,cream:THEME.white};
export function round(g:Laya.Graphics,x:number,y:number,w:number,h:number,r:number,fill:string,line?:string,width=1):void{
 g.drawPath(x,y,[['moveTo',r,0],['lineTo',w-r,0],['arcTo',w,0,w,r,r],['lineTo',w,h-r],['arcTo',w,h,w-r,h,r],['lineTo',r,h],['arcTo',0,h,0,h-r,r],['lineTo',0,r],['arcTo',0,0,r,0,r],['closePath']],{fillStyle:fill},line?{strokeStyle:line,lineWidth:width}:undefined);
}
export function text(parent:Laya.Sprite,content:string,x:number,y:number,w:number,h:number,size=24,color=COLORS.ink,align='center',serif=false):Laya.Text{
 const t=new Laya.Text();t.text=content;t.pos(x,y);t.size(w,h);t.font=serif?'jade-song, Noto Serif CJK SC, Songti SC, SimSun, serif':'jade-text, Noto Sans CJK SC, Microsoft YaHei, sans-serif';t.fontSize=size;t.color=color;t.align=align;t.valign='middle';t.wordWrap=true;t.leading=8;t.mouseEnabled=false;parent.addChild(t);return t;
}
export function panel(parent:Laya.Sprite,x:number,y:number,w:number,h:number,r=24,fill=COLORS.cream,line=THEME.faint):Laya.Sprite{
 const s=new Laya.Sprite();s.pos(x,y);s.size(w,h);s.mouseEnabled=false;
 round(s.graphics,0,0,w,h,r,fill,line,1.3);
 s.cacheAs='bitmap';parent.addChild(s);return s;
}
// Graphics.drawPath in the bundled 3.4 engine only accepts move/line/arc/close.
// Flatten quadratic curves locally rather than relying on an unsupported command.
export function curvedPath(g:Laya.Graphics,x:number,y:number,commands:unknown[][],brush?:{fillStyle:string},pen?:{strokeStyle:string;lineWidth:number}):void{
 const out:unknown[][]=[];let px=0,py=0;
 for(const cmd of commands){
  if(cmd[0]==='quadraticCurveTo'){
   const [cx,cy,ex,ey]=cmd.slice(1) as number[];
   for(let i=1;i<=10;i++){const t=i/10,u=1-t;out.push(['lineTo',u*u*px+2*u*t*cx+t*t*ex,u*u*py+2*u*t*cy+t*t*ey])}
   px=ex;py=ey;
  }else{out.push(cmd);if(cmd[0]==='moveTo'||cmd[0]==='lineTo'){px=cmd[1] as number;py=cmd[2] as number}}
 }
 g.drawPath(x,y,out,brush,pen);
}
export type Icon='erase'|'play'|'map'|'settings'|'sound'|'mute'|'help'|'home'|'back'|'undo'|'restart'|'hint'|'demo'|'left'|'right'|'lock'|'star'|'signin'|'bag'|'close';
export function icon(g:Laya.Graphics,kind:Icon,x:number,y:number,size:number,color:string):void{
 if(kind==='hint'||kind==='erase'){
  g.drawImage(Laya.loader.getRes(kind==='hint'?FEATURE_ART.hintTool:FEATURE_ART.eraseTool),x,y,size,size);
  return;
 }
 const s=size/24;const line=(a:number,b:number,c:number,d:number)=>g.drawLine(x+a*s,y+b*s,x+c*s,y+d*s,color,2*s);
 const poly=(p:number[],fill:string|null=color)=>g.drawPoly(x,y,p.map(v=>v*s),fill,fill?null:color,2*s);
 if(kind==='play'||kind==='demo')poly([8,4,21,12,8,20]);
 else if(kind==='left'||kind==='right'||kind==='back'){
  const sign=kind==='right'?-1:1;line(12+4*sign,4,12-4*sign,12);line(12-4*sign,12,12+4*sign,20);
 }else if(kind==='map'){poly([2,4,9,2,16,5,22,3,22,20,16,22,9,19,2,21],null);line(9,2,9,19);line(16,5,16,22)}
 else if(kind==='sound'||kind==='mute'){poly([2,9,7,9,13,4,13,20,7,15,2,15]);if(kind==='mute'){line(17,8,23,16);line(23,8,17,16)}else{curvedPath(g,x,y,[['moveTo',17*s,6*s],['quadraticCurveTo',25*s,12*s,17*s,18*s]],undefined,{strokeStyle:color,lineWidth:2*s})}}
 else if(kind==='help'){g.drawCircle(x+12*s,y+12*s,10*s,null,color,1.7*s);curvedPath(g,x,y,[['moveTo',8*s,8*s],['quadraticCurveTo',12*s,2*s,16*s,8*s],['quadraticCurveTo',17*s,11*s,12*s,12*s],['lineTo',12*s,15*s]],undefined,{strokeStyle:color,lineWidth:2*s});g.drawCircle(x+12*s,y+18*s,s,color)}
 else if(kind==='settings'){g.drawCircle(x+12*s,y+12*s,7*s,null,color,2*s);g.drawCircle(x+12*s,y+12*s,2.6*s,null,color,1.6*s);for(let a=0;a<8;a++){const t=a*Math.PI/4;line(12+8*Math.cos(t),12+8*Math.sin(t),12+11*Math.cos(t),12+11*Math.sin(t))}}
 else if(kind==='home'){poly([2,11,12,2,22,11],null);poly([5,10,5,22,10,22,10,15,14,15,14,22,19,22,19,10],null)}
 else if(kind==='undo'||kind==='restart'){curvedPath(g,x,y,[['moveTo',5*s,7*s],['quadraticCurveTo',17*s,-1*s,21*s,11*s],['quadraticCurveTo',24*s,24*s,7*s,21*s]],undefined,{strokeStyle:color,lineWidth:2*s});poly([2,2,2,11,10,10],null)}
 else if(kind==='lock'){round(g,x+5*s,y+10*s,14*s,12*s,3*s,color);curvedPath(g,x,y,[['moveTo',7*s,10*s],['lineTo',7*s,6*s],['quadraticCurveTo',12*s,-2*s,17*s,6*s],['lineTo',17*s,10*s]],undefined,{strokeStyle:color,lineWidth:2*s})}
 else if(kind==='signin'){
  // Calendar leaf: the same minimal line drawing as the existing game icons.
  round(g,x+3*s,y+5*s,18*s,16*s,3*s,THEME.white,color,1.6*s);
  g.drawLine(x+3*s,y+10*s,x+21*s,y+10*s,color,1.6*s);
  line(8,2,8,7);line(16,2,16,7);
  flower(g,x+12*s,y+15*s,2.3*s,color);
 }
 else if(kind==='bag'){
  // Small stitched pouch with a tie and a flower seal.
  curvedPath(g,x,y,[['moveTo',6*s,7*s],['quadraticCurveTo',4*s,12*s,4*s,17*s],['quadraticCurveTo',4*s,23*s,12*s,23*s],['quadraticCurveTo',20*s,23*s,20*s,17*s],['quadraticCurveTo',20*s,12*s,18*s,7*s],['closePath']],{fillStyle:THEME.pink},{strokeStyle:color,lineWidth:1.6*s});
  line(6,8,18,8);line(8,3,16,3);line(8,3,9,8);line(16,3,15,8);
  flower(g,x+12*s,y+16*s,2.5*s,color);
 }
 else if(kind==='close'){line(5,5,19,19);line(19,5,5,19)}
 else if(kind==='star'){const pts:number[]=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?4.5:10;pts.push(12+Math.cos(a)*r,12+Math.sin(a)*r)}poly(pts)}
}
export class Button extends Laya.Sprite {
 static feedback:(()=>void)|null=null;
 label:Laya.Text; skin=new Laya.Sprite();private enabled_=true;private pressed=false;
 // State layers are independent of the artwork. The background and icon never
 // move, rescale or change opacity during clicks or enable/disable transitions.
 private iconSprite=new Laya.Sprite();
 private pressedCover=new Laya.Sprite();
 private disabledCover=new Laya.Sprite();
 constructor(title:string,x:number,y:number,w:number,h:number,callback:()=>void,primary=false,kind?:Icon){
  super();this.pos(x,y);this.size(w,h);this.mouseEnabled=true;this.name='button:'+title;
  const r=Math.min(h*.25,18),g=this.skin.graphics;this.skin.size(w,h);this.skin.mouseEnabled=false;this.addChild(this.skin);
  const face=primary?THEME.rose:THEME.pink,rim=primary?THEME.rose:THEME.line;
  // Flat flower-window ends stay inside the hit rectangle. Small controls stay plain.
  if(title&&w>=200&&h<=110){
   const tab=Math.min(16,h*.18);
   g.drawCircle(tab,h/2,tab,face,rim,1.2);g.drawCircle(w-tab,h/2,tab,face,rim,1.2);
   round(g,tab,0,w-tab*2,h,r,face,rim,1.2);
   flower(g,tab,h/2,3,primary?THEME.pink:THEME.line);
   flower(g,w-tab,h/2,3,primary?THEME.pink:THEME.line);
  }else round(g,0,0,w,h,r,face,rim,1.2);
  this.iconSprite.size(26,26);this.iconSprite.mouseEnabled=false;this.addChild(this.iconSprite);
  this.label=text(this,title,0,0,w,h,h>=82?32:23,primary?THEME.white:THEME.ink,'center',true);
  // These lightweight overlays are toggled without mutating any renderable
  // background or icon transform, which was losing the button's skin on WebGL.
  for(const cover of [this.pressedCover,this.disabledCover]){
   cover.size(w,h);cover.mouseEnabled=false;cover.cacheAs='none';cover.visible=false;
   this.addChild(cover);
  }
  round(this.pressedCover.graphics,0,0,w,h,r,'rgba(104,72,83,0.13)');
  round(this.disabledCover.graphics,0,0,w,h,r,'rgba(252,247,243,0.52)');
  if(!title)this.label.visible=false;
  if(kind)this.setIcon(kind,primary);
  else {this.label.pos(8,0);this.label.size(w-16,h)}
  // Keep every interactive button layer live. Only static page art may be cached.
  this.skin.cacheAs='none';
  this.on(Laya.Event.MOUSE_DOWN,this,()=>this.press(true));
  this.on(Laya.Event.MOUSE_UP,this,()=>this.press(false));
  this.on(Laya.Event.MOUSE_OUT,this,()=>this.press(false));
  this.on(Laya.Event.CLICK,this,()=>{if(this.enabled_){this.press(false);callback();Button.feedback?.()}});
 }
 private press(v:boolean):void{if(!this.enabled_||this.pressed===v)return;this.pressed=v;this.pressedCover.visible=v}
 set enabled(v:boolean){if(v===this.enabled_)return;this.press(false);this.enabled_=v;this.disabledCover.visible=!v}
 get enabled():boolean{return this.enabled_}
 setIcon(kind:Icon,primary=false):void{
  const g=this.iconSprite.graphics;g.clear();
  const tool=kind==='hint'||kind==='erase';
  const size=tool?Math.min(40,this.height-8):!this.label.visible&&this.height>=92?42:26,gap=tool?6:8;
  this.iconSprite.name='icon:'+kind;
  this.iconSprite.size(size,size);
  if(!this.label.visible)this.iconSprite.pos((this.width-size)/2,this.height>=92?13:(this.height-size)/2);
  else{
   // Centre the entire icon+label group; avoid the former fixed 46px offset.
   if(tool){
    // Keep the painted icon readable and multi-digit inventory on one line.
    const units=[...this.label.text].reduce((sum,ch)=>sum+(/\s/.test(ch)?.35:/[\u0000-\u007f×]/.test(ch)?.56:1),0);
    this.label.fontSize=Math.min(this.height>=82?32:23,Math.max(12,(this.width-size-gap-18)/Math.max(1,units)));
    this.label.wordWrap=false;
   }
   const font=this.label.fontSize;
   const measured=[...this.label.text].reduce((sum,ch)=>sum+((/\s/.test(ch))?.35:((/[\u0000-\u007f]/.test(ch))?.56:1))*font,0)+6;
   const labelW=Math.min(Math.max(34,measured),tool?Math.max(12,this.width-size-gap-12):Math.max(34,this.width-56));
   const left=Math.max(6,(this.width-size-gap-labelW)/2);
   this.iconSprite.pos(left,(this.height-size)/2);
   this.label.pos(left+size+gap,0);
   this.label.size(Math.max(12,this.width-left-size-gap-6),this.height);
   this.label.align='left';
  }
  icon(g,kind,0,0,size,primary?THEME.white:THEME.ink);
 }
}
export function flower(g:Laya.Graphics,x:number,y:number,r:number,color=THEME.line):void{
 for(let k=0;k<4;k++){const a=k*Math.PI/2;g.drawPoly(x+Math.cos(a)*r*1.65,y+Math.sin(a)*r*1.65,[0,-r,r,0,0,r,-r,0],null,color,1)}
}
export function ornament(parent:Laya.Sprite,x:number,y:number,w:number):void{
 const s=new Laya.Sprite();s.mouseEnabled=false;parent.addChild(s);
 const g=s.graphics;g.drawLine(x,y,x+w*.42,y,THEME.line,1);g.drawLine(x+w*.58,y,x+w,y,THEME.line,1);
 flower(g,x+w/2,y,3.8,THEME.rose);
}

